import crypto from 'crypto';
import { dbService } from '../db';
import { auditService } from '../audit';
import { ApprovalRecord, UserRole } from '@permissionos/shared';

export interface CreateApprovalOptions {
  actorId: string;
  toolName: string;
  args: Record<string, unknown>;
  policyVersion: string;
  resourceVersion?: number | null;
  reasonCode: string;
  ttlSeconds?: number;
  correlationId: string;
}

export interface ResolveApprovalOptions {
  approvalId: string;
  decision: 'approve' | 'reject';
  decidedBy: string;
  decidedByRole: UserRole;
  correlationId: string;
}

export const approvalService = {
  createPendingApproval(options: CreateApprovalOptions): ApprovalRecord {
    const approvalId = `apr_${crypto.randomUUID().slice(0, 8)}`;
    const actionId = `act_${crypto.randomUUID()}`;
    const canonicalArgsJson = JSON.stringify(options.args);
    const argsHash = crypto.createHash('sha256').update(canonicalArgsJson).digest('hex');

    const ttl = options.ttlSeconds ?? 300; // 5-minute default
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const record: ApprovalRecord = {
      id: approvalId,
      action_id: actionId,
      actor_id: options.actorId,
      tool_name: options.toolName,
      args_json: canonicalArgsJson,
      args_hash: argsHash,
      policy_version: options.policyVersion,
      resource_version: options.resourceVersion ?? null,
      status: 'pending',
      reason_code: options.reasonCode,
      created_at: createdAt,
      expires_at: expiresAt,
    };

    dbService.createApproval(record);

    auditService.logEvent({
      correlationId: options.correlationId,
      actionId,
      approvalId,
      actorId: options.actorId,
      toolName: options.toolName,
      eventType: 'APPROVAL_CREATED',
      decision: 'approve',
      reasonCode: options.reasonCode,
      safeArgs: options.args,
      details: { expiresAt, ttlSeconds: ttl },
    });

    return record;
  },

  getApproval(approvalId: string): ApprovalRecord | undefined {
    return dbService.getApprovalById(approvalId);
  },

  listApprovals(status?: string): ApprovalRecord[] {
    return dbService.listApprovals(status);
  },

  /**
   * Evaluates claim and approval execution with strict authorization and atomic claim:
   * - Prohibits self-approval by operators
   * - Validates expiration
   * - Executes atomic status update to prevent race conditions / duplicate claims
   */
  async resolveApproval(
    options: ResolveApprovalOptions,
    executeMutationFn: (actionId: string, toolName: string, args: any, resourceVersion?: number | null) => Promise<any>
  ): Promise<{ status: string; result?: any; error?: string }> {
    const approval = dbService.getApprovalById(options.approvalId);
    if (!approval) {
      return { status: 'not_found', error: 'Approval request not found.' };
    }

    // Role check: distinct approver or admin required
    if (options.decidedByRole !== 'approver' && options.decidedByRole !== 'admin') {
      return { status: 'unauthorized', error: 'Only approvers or admins may review approvals.' };
    }

    // Operator cannot approve their own request
    if (options.decidedBy === approval.actor_id) {
      auditService.logEvent({
        correlationId: options.correlationId,
        actionId: approval.action_id,
        approvalId: approval.id,
        actorId: options.decidedBy,
        toolName: approval.tool_name,
        eventType: 'UNAUTHORIZED_ACCESS',
        decision: 'deny',
        reasonCode: 'SELF_APPROVAL_PROHIBITED',
      });
      return { status: 'forbidden', error: 'Self-approval is strictly prohibited.' };
    }

    // Check expiration
    if (new Date(approval.expires_at) <= new Date()) {
      dbService.resolveApproval(approval.id, 'expired', options.decidedBy);
      auditService.logEvent({
        correlationId: options.correlationId,
        actionId: approval.action_id,
        approvalId: approval.id,
        actorId: options.decidedBy,
        toolName: approval.tool_name,
        eventType: 'APPROVAL_EXPIRED',
        decision: 'deny',
        reasonCode: 'EXPIRED_BEFORE_APPROVAL',
      });
      return { status: 'expired', error: 'Approval request has expired (5-minute TTL exceeded).' };
    }

    // Terminal state check
    if (approval.status !== 'pending') {
      return { status: 'invalid_state', error: `Approval is already in terminal state: ${approval.status}` };
    }

    // Handle rejection
    if (options.decision === 'reject') {
      dbService.resolveApproval(approval.id, 'rejected', options.decidedBy);
      auditService.logEvent({
        correlationId: options.correlationId,
        actionId: approval.action_id,
        approvalId: approval.id,
        actorId: options.decidedBy,
        toolName: approval.tool_name,
        eventType: 'APPROVAL_REJECTED',
        decision: 'deny',
        reasonCode: 'HUMAN_REJECTED',
      });
      return { status: 'rejected' };
    }

    // Atomic claim: Transition from 'pending' -> 'executing'
    const claimed = dbService.claimApprovalAtomically(approval.id);
    if (!claimed) {
      return {
        status: 'conflict',
        error: 'Approval could not be claimed (concurrent execution or expired).',
      };
    }

    auditService.logEvent({
      correlationId: options.correlationId,
      actionId: approval.action_id,
      approvalId: approval.id,
      actorId: options.decidedBy,
      toolName: approval.tool_name,
      eventType: 'APPROVAL_APPROVED',
      decision: 'approve',
      reasonCode: 'HUMAN_APPROVED',
    });

    auditService.logEvent({
      correlationId: options.correlationId,
      actionId: approval.action_id,
      approvalId: approval.id,
      actorId: options.decidedBy,
      toolName: approval.tool_name,
      eventType: 'EXECUTION_STARTED',
      decision: 'allow',
      reasonCode: 'MUTATION_STARTED',
    });

    try {
      const storedArgs = JSON.parse(approval.args_json);
      const executionResult = await executeMutationFn(
        approval.action_id,
        approval.tool_name,
        storedArgs,
        approval.resource_version
      );

      dbService.resolveApproval(approval.id, 'executed', options.decidedBy, 'success');

      auditService.logEvent({
        correlationId: options.correlationId,
        actionId: approval.action_id,
        approvalId: approval.id,
        actorId: options.decidedBy,
        toolName: approval.tool_name,
        eventType: 'EXECUTION_SUCCEEDED',
        decision: 'allow',
        reasonCode: 'MUTATION_APPLIED',
        details: { result: executionResult },
      });

      return { status: 'executed', result: executionResult };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isConflict = errorMsg.includes('conflict') || errorMsg.includes('version');
      const finalStatus = isConflict ? 'conflicted' : 'failed';

      dbService.resolveApproval(approval.id, finalStatus, options.decidedBy, errorMsg);

      auditService.logEvent({
        correlationId: options.correlationId,
        actionId: approval.action_id,
        approvalId: approval.id,
        actorId: options.decidedBy,
        toolName: approval.tool_name,
        eventType: isConflict ? 'EXECUTION_CONFLICTED' : 'EXECUTION_FAILED',
        decision: 'deny',
        reasonCode: isConflict ? 'STALE_VERSION_CONFLICT' : 'EXECUTION_FAILED',
        details: { error: errorMsg },
      });

      return { status: finalStatus, error: errorMsg };
    }
  },
};
