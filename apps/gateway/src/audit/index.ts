import crypto from 'crypto';
import { dbService } from '../db';
import { AuditEventType, AuditRecord } from '@permissionos/shared';

export interface LogAuditOptions {
  correlationId: string;
  actionId?: string | null;
  approvalId?: string | null;
  actorId: string;
  toolName: string;
  eventType: AuditEventType;
  decision: 'allow' | 'approve' | 'deny';
  reasonCode: string;
  safeArgs?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}

export function sanitizeArgs(args?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!args) return null;
  const sanitized = { ...args };
  const sensitiveKeys = ['token', 'secret', 'password', 'key', 'auth', 'credit_card'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

export const auditService = {
  logEvent(options: LogAuditOptions): AuditRecord {
    const id = `aud_${crypto.randomUUID().slice(0, 8)}`;
    const safeArgsJson = options.safeArgs ? JSON.stringify(sanitizeArgs(options.safeArgs)) : null;
    const detailsJson = options.details ? JSON.stringify(options.details) : null;

    dbService.recordAuditEvent({
      id,
      correlationId: options.correlationId,
      actionId: options.actionId,
      approvalId: options.approvalId,
      actorId: options.actorId,
      toolName: options.toolName,
      eventType: options.eventType,
      decision: options.decision,
      reasonCode: options.reasonCode,
      safeArgsJson,
      detailsJson,
    });

    return {
      id,
      correlation_id: options.correlationId,
      action_id: options.actionId ?? null,
      approval_id: options.approvalId ?? null,
      actor_id: options.actorId,
      tool_name: options.toolName,
      event_type: options.eventType,
      decision: options.decision,
      reason_code: options.reasonCode,
      safe_args_json: safeArgsJson,
      details_json: detailsJson,
      created_at: new Date().toISOString(),
    };
  },

  getRecentEvents(limit = 50): AuditRecord[] {
    return dbService.listAuditEvents(limit);
  },
};
