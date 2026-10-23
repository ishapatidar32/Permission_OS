-- PermissionOS SQLite Initial Schema Migration
-- Matches PRD Section 10 Specification

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('operator', 'approver', 'admin')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  action_id TEXT UNIQUE NOT NULL,
  actor_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  args_hash TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  resource_version INTEGER,
  status TEXT NOT NULL CHECK(status IN ('pending', 'rejected', 'expired', 'executing', 'executed', 'failed', 'outcome_unknown', 'conflicted')),
  reason_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  execution_status TEXT,
  completed_at TEXT,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  action_id TEXT,
  approval_id TEXT,
  actor_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('allow', 'approve', 'deny')),
  reason_code TEXT NOT NULL,
  safe_args_json TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applied_actions (
  action_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  result_version INTEGER NOT NULL,
  executed_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_expires_at ON approvals(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
