export type UserRole = 'operator' | 'approver' | 'admin';

export interface User {
  id: string;
  display_name: string;
  role: UserRole;
  active: number;
}

export interface Order {
  id: string;
  customer_name: string;
  address: string;
  status: string;
  version: number;
  updated_at: string;
}

export type ApprovalStatus =
  | 'pending'
  | 'rejected'
  | 'expired'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'outcome_unknown'
  | 'conflicted';

export interface ApprovalRecord {
  id: string;
  action_id: string;
  actor_id: string;
  tool_name: string;
  args_json: string;
  args_hash: string;
  policy_version: string;
  resource_version?: number | null;
  status: ApprovalStatus;
  reason_code: string;
  created_at: string;
  expires_at: string;
  decided_by?: string | null;
  decided_at?: string | null;
  execution_status?: string | null;
  completed_at?: string | null;
}

export type AuditEventType =
  | 'REQUEST_RECEIVED'
  | 'INPUT_REJECTED'
  | 'POLICY_ALLOWED'
  | 'APPROVAL_CREATED'
  | 'POLICY_DENIED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_EXPIRED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_SUCCEEDED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_OUTCOME_UNKNOWN'
  | 'EXECUTION_CONFLICTED'
  | 'UNAUTHORIZED_ACCESS';

export interface AuditRecord {
  id: string;
  correlation_id: string;
  action_id?: string | null;
  approval_id?: string | null;
  actor_id: string;
  tool_name: string;
  event_type: AuditEventType;
  decision: 'allow' | 'approve' | 'deny';
  reason_code: string;
  safe_args_json?: string | null;
  details_json?: string | null;
  created_at: string;
}

export interface AppliedAction {
  action_id: string;
  order_id: string;
  result_version: number;
  executed_at: string;
}

export interface ApiKeyRecord {
  id: string;
  actor_id: string;
  token_hash: string;
  label: string;
  revoked_at?: string | null;
}

export interface ActorContext {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  correlationId: string;
}
