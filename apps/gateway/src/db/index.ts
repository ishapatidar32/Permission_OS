import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  Order,
  ApprovalRecord,
  AuditRecord,
  AppliedAction,
  ApiKeyRecord,
  ApprovalStatus,
  AuditEventType,
} from '@permissionos/shared';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'permissionos.db');

export function initDatabase(dbPath = DB_PATH): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load migration
  const migrationPath = path.resolve(process.cwd(), 'migrations', '001_initial.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);
  }

  return db;
}

export const db = initDatabase();

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const dbService = {
  initDatabase,
  // Users
  getUserById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  listUsers(): User[] {
    return db.prepare('SELECT * FROM users WHERE active = 1').all() as User[];
  },

  // Auth / API Keys
  findUserByToken(token: string): User | undefined {
    const tokenHash = hashToken(token);
    const row = db
      .prepare(
        `SELECT u.* FROM users u
         JOIN api_keys k ON u.id = k.actor_id
         WHERE k.token_hash = ? AND k.revoked_at IS NULL AND u.active = 1`
      )
      .get(tokenHash) as User | undefined;
    return row;
  },

  // Orders
  getOrder(id: string): Order | undefined {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  },

  listOrders(): Order[] {
    return db.prepare('SELECT * FROM orders').all() as Order[];
  },

  updateOrderAddress(id: string, newAddress: string, expectedVersion: number): boolean {
    const info = db
      .prepare(
        `UPDATE orders
         SET address = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`
      )
      .run(newAddress, new Date().toISOString(), id, expectedVersion);
    return info.changes > 0;
  },

  // Approvals
  createApproval(record: Omit<ApprovalRecord, 'status'> & { status?: ApprovalStatus }): void {
    const status = record.status || 'pending';
    db.prepare(
      `INSERT INTO approvals (
        id, action_id, actor_id, tool_name, args_json, args_hash,
        policy_version, resource_version, status, reason_code,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.action_id,
      record.actor_id,
      record.tool_name,
      record.args_json,
      record.args_hash,
      record.policy_version,
      record.resource_version ?? null,
      status,
      record.reason_code,
      record.created_at,
      record.expires_at
    );
  },

  getApprovalById(id: string): ApprovalRecord | undefined {
    return db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as ApprovalRecord | undefined;
  },

  listApprovals(status?: string): ApprovalRecord[] {
    if (status) {
      return db
        .prepare('SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC')
        .all(status) as ApprovalRecord[];
    }
    return db
      .prepare('SELECT * FROM approvals ORDER BY created_at DESC')
      .all() as ApprovalRecord[];
  },

  /**
   * Atomic claim matching PRD Section 9.3:
   * UPDATE approvals SET status='executing' WHERE id=? AND status='pending' AND expires_at>NOW()
   */
  claimApprovalAtomically(id: string, nowIso = new Date().toISOString()): boolean {
    const info = db
      .prepare(
        `UPDATE approvals
         SET status = 'executing'
         WHERE id = ? AND status = 'pending' AND expires_at > ?`
      )
      .run(id, nowIso);
    return info.changes > 0;
  },

  resolveApproval(
    id: string,
    status: Exclude<ApprovalStatus, 'pending' | 'executing'>,
    decidedBy?: string | null,
    executionStatus?: string
  ): void {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE approvals
       SET status = ?, decided_by = ?, decided_at = ?, execution_status = ?, completed_at = ?
       WHERE id = ?`
    ).run(status, decidedBy ?? null, now, executionStatus ?? null, now, id);
  },

  // Audit Events
  recordAuditEvent(event: {
    id: string;
    correlationId: string;
    actionId?: string | null;
    approvalId?: string | null;
    actorId: string;
    toolName: string;
    eventType: AuditEventType;
    decision: 'allow' | 'approve' | 'deny';
    reasonCode: string;
    safeArgsJson?: string | null;
    detailsJson?: string | null;
    createdAt?: string;
  }): void {
    const now = event.createdAt || new Date().toISOString();
    db.prepare(
      `INSERT INTO audit_events (
        id, correlation_id, action_id, approval_id, actor_id,
        tool_name, event_type, decision, reason_code,
        safe_args_json, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      event.correlationId,
      event.actionId ?? null,
      event.approvalId ?? null,
      event.actorId,
      event.toolName,
      event.eventType,
      event.decision,
      event.reasonCode,
      event.safeArgsJson ?? null,
      event.detailsJson ?? null,
      now
    );
  },

  listAuditEvents(limit = 50): AuditRecord[] {
    return db
      .prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as AuditRecord[];
  },

  // Applied Actions (Idempotency enforcement)
  hasActionBeenApplied(actionId: string): boolean {
    const row = db.prepare('SELECT action_id FROM applied_actions WHERE action_id = ?').get(actionId);
    return Boolean(row);
  },

  recordAppliedAction(actionId: string, orderId: string, resultVersion: number): void {
    db.prepare(
      `INSERT INTO applied_actions (action_id, order_id, result_version, executed_at)
       VALUES (?, ?, ?, ?)`
    ).run(actionId, orderId, resultVersion, new Date().toISOString());
  },
};
