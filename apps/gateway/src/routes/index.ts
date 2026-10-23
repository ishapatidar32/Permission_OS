import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { dbService } from '../db';
import { requireAuth, resolveActor } from '../auth';
import { approvalService } from '../approvals';
import { auditService } from '../audit';
import { activePolicy } from '../policy';
import { gatewayMCPServer, JSONRPCRequest } from '../mcp/mcp-server';
import { upstreamClient } from '../mcp/upstream-client';
import { DecisionInputSchema, TOOL_NAMES, DEMO_ORDERS } from '@permissionos/shared';

export const router = express.Router();

// Middleware to assign correlationId
router.use((req: Request, res: Response, next) => {
  req.correlationId = (req.headers['x-correlation-id'] as string) || `corr_${crypto.randomUUID().slice(0, 8)}`;
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
});

// GET /api/health
router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
    correlationId: req.correlationId!,
  });
});

// GET /api/me
router.get('/me', (req: Request, res: Response) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'No active session or valid bearer token.' },
      correlationId: req.correlationId!,
    });
    return;
  }
  res.json({
    ok: true,
    data: actor,
    correlationId: req.correlationId!,
  });
});

// Demo switch role route for UI demo simulation (sets HttpOnly cookie)
router.post('/demo/login-as', (req: Request, res: Response) => {
  const { role } = req.body;
  const users = dbService.listUsers();
  const user = users.find((u) => u.role === role);
  if (!user) {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: `No active user found for role ${role}` },
      correlationId: req.correlationId!,
    });
    return;
  }

  res.cookie('permissionos_session_user', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    ok: true,
    data: {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
    },
    correlationId: req.correlationId!,
  });
});

// POST /api/demo/intent (Bounded Intent Router invokes MCP server via official contracts)
router.post('/demo/intent', requireAuth(['operator', 'admin']), async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: 'Prompt string is required' },
      correlationId: req.correlationId!,
    });
    return;
  }

  const normalized = prompt.toLowerCase().trim();
  let selectedTool: string;
  let toolArgs: Record<string, unknown>;

  if (normalized.includes('export') || (normalized.includes('customer') && !normalized.includes('order'))) {
    selectedTool = TOOL_NAMES.EXPORT_ALL_CUSTOMERS;
    toolArgs = { format: 'json' };
  } else if (normalized.includes('where is') || normalized.includes('status of order') || normalized.includes('read')) {
    selectedTool = TOOL_NAMES.READ_ORDER;
    const match = prompt.match(/\b\d{4}\b/);
    toolArgs = { orderId: match ? match[0] : DEMO_ORDERS.PRIMARY_ORDER_ID };
  } else if (normalized.includes('update') || normalized.includes('change') || normalized.includes('address')) {
    selectedTool = TOOL_NAMES.UPDATE_DELIVERY_ADDRESS;
    toolArgs = {
      orderId: DEMO_ORDERS.PRIMARY_ORDER_ID,
      address: DEMO_ORDERS.PROPOSED_ADDRESS,
    };
  } else {
    res.status(422).json({
      ok: false,
      error: {
        code: 'UNRECOGNIZED_INTENT',
        message:
          'Unrecognized intent. Try: "Where is order 1042?", "Update order 1042\'s delivery address to 45 Office Park, Jaipur", or "Export every customer\'s name and address"',
      },
      correlationId: req.correlationId!,
    });
    return;
  }

  // Invoke gateway MCP server with the authenticated actor
  const mcpReq: JSONRPCRequest = {
    jsonrpc: '2.0',
    id: `req_${Date.now()}`,
    method: 'tools/call',
    params: {
      name: selectedTool,
      arguments: toolArgs,
    },
  };

  const response = await gatewayMCPServer.handleRequest(mcpReq, req.actor!, req.correlationId!);

  res.json({
    ok: true,
    data: {
      selectedTool,
      args: toolArgs,
      mcpResponse: response,
    },
    correlationId: req.correlationId!,
  });
});

// GET /api/orders/1042 (Current synthetic order view via gateway/upstream)
router.get('/orders/:id', requireAuth(['operator', 'approver', 'admin']), async (req: Request, res: Response) => {
  const orderId = req.params.id;
  try {
    const order = await upstreamClient.readOrder(orderId);
    res.json({
      ok: true,
      data: order,
      correlationId: req.correlationId!,
    });
  } catch (err: any) {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: err.message },
      correlationId: req.correlationId!,
    });
  }
});

// GET /api/approvals?status=pending
router.get('/approvals', requireAuth(['approver', 'admin']), (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const approvals = approvalService.listApprovals(status);
  res.json({
    ok: true,
    data: approvals,
    correlationId: req.correlationId!,
  });
});

// GET /api/approvals/:id
router.get('/approvals/:id', requireAuth(['operator', 'approver', 'admin']), (req: Request, res: Response) => {
  const approval = approvalService.getApproval(req.params.id);
  if (!approval) {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Approval record not found' },
      correlationId: req.correlationId!,
    });
    return;
  }

  // Scoped initiator check
  if (req.actor!.role === 'operator' && approval.actor_id !== req.actor!.id) {
    res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Cannot access approvals created by another operator' },
      correlationId: req.correlationId!,
    });
    return;
  }

  res.json({
    ok: true,
    data: approval,
    correlationId: req.correlationId!,
  });
});

// POST /api/approvals/:id/decision
router.post('/approvals/:id/decision', requireAuth(['approver', 'admin']), async (req: Request, res: Response) => {
  const approvalId = req.params.id;
  const parseResult = DecisionInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(422).json({
      ok: false,
      error: { code: 'INVALID_DECISION', message: 'Decision must be "approve" or "reject"' },
      correlationId: req.correlationId!,
    });
    return;
  }

  const result = await approvalService.resolveApproval(
    {
      approvalId,
      decision: parseResult.data.decision,
      decidedBy: req.actor!.id,
      decidedByRole: req.actor!.role,
      correlationId: req.correlationId!,
    },
    async (actionId, toolName, args, resourceVersion) => {
      // Execute the mutation against downstream MCP service
      if (toolName === TOOL_NAMES.UPDATE_DELIVERY_ADDRESS) {
        return upstreamClient.updateDeliveryAddress(actionId, args.orderId, args.address, resourceVersion);
      }
      throw new Error(`Unsupported approved mutation tool: ${toolName}`);
    }
  );

  if (result.status === 'not_found') {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: result.error! },
      correlationId: req.correlationId!,
    });
    return;
  }

  if (result.status === 'forbidden') {
    res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: result.error! },
      correlationId: req.correlationId!,
    });
    return;
  }

  if (result.status === 'expired' || result.status === 'conflict') {
    res.status(409).json({
      ok: false,
      error: { code: result.status.toUpperCase(), message: result.error! },
      correlationId: req.correlationId!,
    });
    return;
  }

  res.json({
    ok: true,
    data: result,
    correlationId: req.correlationId!,
  });
});

// GET /api/actions/:id
router.get('/actions/:id', requireAuth(['operator', 'approver', 'admin']), (req: Request, res: Response) => {
  const approvals = approvalService.listApprovals();
  const match = approvals.find((a) => a.action_id === req.params.id);
  if (!match) {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Action not found' },
      correlationId: req.correlationId!,
    });
    return;
  }

  res.json({
    ok: true,
    data: match,
    correlationId: req.correlationId!,
  });
});

// GET /api/audit?limit=50&cursor=...
router.get('/audit', requireAuth(['approver', 'admin']), (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const events = auditService.getRecentEvents(limit);
  res.json({
    ok: true,
    data: events,
    correlationId: req.correlationId!,
  });
});

// GET /api/policies/current
router.get('/policies/current', requireAuth(['approver', 'admin']), (req: Request, res: Response) => {
  res.json({
    ok: true,
    data: activePolicy,
    correlationId: req.correlationId!,
  });
});

// POST /api/admin/reset-demo
router.post('/admin/reset-demo', requireAuth(['admin']), async (req: Request, res: Response) => {
  await upstreamClient.reset();
  // Clear approvals and audit events for demo reset
  dbService.initDatabase(); // ensures schema
  res.json({
    ok: true,
    data: { message: 'Demo environment reset successfully.' },
    correlationId: req.correlationId!,
  });
});

// POST /mcp & GET /mcp (Streamable HTTP MCP JSON-RPC endpoint)
router.all('/mcp', async (req: Request, res: Response) => {
  // PRD 7.1: Origin validation
  const origin = req.headers.origin;
  if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    res.status(403).json({ error: 'Forbidden: Invalid Origin' });
    return;
  }

  // PRD 7.1: GET /mcp returns 405 when standalone SSE listening is not offered
  if (req.method === 'GET') {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method Not Allowed: Use POST for MCP JSON-RPC requests' },
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: 401, message: 'Authentication required. Missing Bearer token or session.' },
    });
    return;
  }

  try {
    const response = await gatewayMCPServer.handleRequest(req.body, actor, req.correlationId!);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: err.message },
    });
  }
});
