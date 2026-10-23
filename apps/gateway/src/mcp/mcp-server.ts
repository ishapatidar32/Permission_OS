import crypto from 'crypto';
import { policyEngine, activePolicy } from '../policy';
import { approvalService } from '../approvals';
import { auditService } from '../audit';
import { upstreamClient } from './upstream-client';
import { dbService } from '../db';
import {
  ActorContext,
  TOOL_NAMES,
  ReadOrderInputSchema,
  UpdateDeliveryAddressInputSchema,
  ExportAllCustomersInputSchema,
  GetActionStatusInputSchema,
} from '@permissionos/shared';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class GatewayMCPServer {
  public async handleRequest(
    req: JSONRPCRequest,
    actor: ActorContext,
    correlationId = `req_${crypto.randomUUID().slice(0, 8)}`
  ): Promise<JSONRPCResponse> {
    const id = req.id ?? null;

    auditService.logEvent({
      correlationId,
      actorId: actor.id,
      toolName: req.params?.name || req.method,
      eventType: 'REQUEST_RECEIVED',
      decision: 'allow',
      reasonCode: 'MCP_REQUEST_RECEIVED',
      safeArgs: req.params?.arguments,
      details: { method: req.method },
    });

    switch (req.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'permissionos-gateway',
              version: '0.1.0',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: TOOL_NAMES.READ_ORDER,
                description: 'Lookup customer order delivery status and address details',
                inputSchema: {
                  type: 'object',
                  properties: {
                    orderId: { type: 'string', description: 'Order ID (1-32 chars)' },
                  },
                  required: ['orderId'],
                },
              },
              {
                name: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
                description: 'Update order delivery address (Requires Human Approval)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    orderId: { type: 'string', description: 'Order ID (1-32 chars)' },
                    address: { type: 'string', description: 'New street address (5-200 chars)' },
                  },
                  required: ['orderId', 'address'],
                },
              },
              {
                name: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
                description: 'Export all customer names and addresses (Prohibited by Policy)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    format: { type: 'string', enum: ['json', 'csv'] },
                  },
                },
              },
              {
                name: TOOL_NAMES.GET_ACTION_STATUS,
                description: 'Check status of an action or pending approval by approvalId',
                inputSchema: {
                  type: 'object',
                  properties: {
                    approvalId: { type: 'string' },
                  },
                  required: ['approvalId'],
                },
              },
            ],
          },
        };

      case 'tools/call': {
        const toolName = req.params?.name;
        const rawArgs = req.params?.arguments || {};

        if (!toolName) {
          auditService.logEvent({
            correlationId,
            actorId: actor.id,
            toolName: 'unknown',
            eventType: 'INPUT_REJECTED',
            decision: 'deny',
            reasonCode: 'MISSING_TOOL_NAME',
          });
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: tool name is required' },
          };
        }

        // 1. Strict Schema Validation
        let validatedArgs: any = rawArgs;
        try {
          if (toolName === TOOL_NAMES.READ_ORDER) {
            validatedArgs = ReadOrderInputSchema.parse(rawArgs);
          } else if (toolName === TOOL_NAMES.UPDATE_DELIVERY_ADDRESS) {
            validatedArgs = UpdateDeliveryAddressInputSchema.parse(rawArgs);
          } else if (toolName === TOOL_NAMES.EXPORT_ALL_CUSTOMERS) {
            validatedArgs = ExportAllCustomersInputSchema.parse(rawArgs);
          } else if (toolName === TOOL_NAMES.GET_ACTION_STATUS) {
            validatedArgs = GetActionStatusInputSchema.parse(rawArgs);
          } else {
            auditService.logEvent({
              correlationId,
              actorId: actor.id,
              toolName,
              eventType: 'INPUT_REJECTED',
              decision: 'deny',
              reasonCode: 'UNKNOWN_TOOL',
            });
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool not found: ${toolName}` },
            };
          }
        } catch (validationErr: any) {
          auditService.logEvent({
            correlationId,
            actorId: actor.id,
            toolName,
            eventType: 'INPUT_REJECTED',
            decision: 'deny',
            reasonCode: 'MALFORMED_INPUT',
            safeArgs: rawArgs,
            details: { error: validationErr.message },
          });
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Input validation failed: ${validationErr.message}` },
          };
        }

        // 2. Deterministic Policy Evaluation via mcp-policy-kit
        const decision = policyEngine.evaluate({
          tool: toolName,
          actorRole: actor.role,
          resource: validatedArgs?.orderId,
          args: validatedArgs,
        });

        // 3. Effect: DENY
        if (decision.effect === 'deny') {
          auditService.logEvent({
            correlationId,
            actorId: actor.id,
            toolName,
            eventType: 'POLICY_DENIED',
            decision: 'deny',
            reasonCode: decision.reasonCode,
            safeArgs: validatedArgs,
          });

          // Downstream tool is NEVER called!
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Operation blocked by policy rule [${decision.reasonCode}]: Bulk customer export is not permitted.`,
                },
              ],
              isError: true,
              status: 'denied',
              reasonCode: decision.reasonCode,
              message: 'Bulk customer export is not permitted',
              correlationId,
            },
          };
        }

        // 4. Effect: APPROVE (Require Approval)
        if (decision.effect === 'approve') {
          // Retrieve current resource version if applicable
          let resourceVersion: number | null = null;
          if (validatedArgs.orderId) {
            const currentOrder = dbService.getOrder(validatedArgs.orderId);
            if (currentOrder) {
              resourceVersion = currentOrder.version;
            }
          }

          const approval = approvalService.createPendingApproval({
            actorId: actor.id,
            toolName,
            args: validatedArgs,
            policyVersion: decision.policyVersion,
            resourceVersion,
            reasonCode: decision.reasonCode,
            ttlSeconds: decision.approvalTtlSeconds,
            correlationId,
          });

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Action requires human authorization. Pending ticket ${approval.id} created.`,
                },
              ],
              isError: false,
              status: 'approval_required',
              approvalId: approval.id,
              actionId: approval.action_id,
              tool: toolName,
              expiresAt: approval.expires_at,
              correlationId,
            },
          };
        }

        // 5. Effect: ALLOW
        auditService.logEvent({
          correlationId,
          actorId: actor.id,
          toolName,
          eventType: 'POLICY_ALLOWED',
          decision: 'allow',
          reasonCode: decision.reasonCode,
          safeArgs: validatedArgs,
        });

        // Tool-specific allowed execution
        if (toolName === TOOL_NAMES.READ_ORDER) {
          try {
            const order = await upstreamClient.readOrder(validatedArgs.orderId);

            auditService.logEvent({
              correlationId,
              actorId: actor.id,
              toolName,
              eventType: 'EXECUTION_SUCCEEDED',
              decision: 'allow',
              reasonCode: 'READ_SUCCEEDED',
              details: { orderId: order.id, status: order.status },
            });

            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Order ${order.id} status: ${order.status}. Delivery Address: ${order.address}`,
                  },
                ],
                order,
                correlationId,
              },
            };
          } catch (readErr: any) {
            auditService.logEvent({
              correlationId,
              actorId: actor.id,
              toolName,
              eventType: 'EXECUTION_FAILED',
              decision: 'allow',
              reasonCode: 'DOWNSTREAM_READ_FAILED',
              details: { error: readErr.message },
            });

            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32000, message: `Downstream order lookup failed: ${readErr.message}` },
            };
          }
        }

        if (toolName === TOOL_NAMES.GET_ACTION_STATUS) {
          const approval = approvalService.getApproval(validatedArgs.approvalId);
          if (!approval) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: `Approval not found: ${validatedArgs.approvalId}` },
            };
          }

          // Check actor scoping: must be initiator, approver, or admin
          if (actor.role === 'operator' && approval.actor_id !== actor.id) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: 403, message: 'Forbidden: Action status is scoped to initiator/approver' },
            };
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              status: approval.status,
              approvalId: approval.id,
              actionId: approval.action_id,
              tool: approval.tool_name,
              executionStatus: approval.execution_status,
              correlationId,
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unhandled allowed tool: ${toolName}` },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
    }
  }
}

export const gatewayMCPServer = new GatewayMCPServer();
