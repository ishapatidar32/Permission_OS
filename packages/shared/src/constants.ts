export const MCP_VERSION = '2025-11-25';

export const TOOL_NAMES = {
  READ_ORDER: 'read_order',
  UPDATE_DELIVERY_ADDRESS: 'update_delivery_address',
  EXPORT_ALL_CUSTOMERS: 'export_all_customers',
  GET_ACTION_STATUS: 'get_action_status',
} as const;

export const REASON_CODES = {
  READ_ALLOWED: 'READ_ALLOWED',
  SENSITIVE_WRITE: 'SENSITIVE_WRITE',
  BULK_EXPORT_BLOCKED: 'BULK_EXPORT_BLOCKED',
  STATUS_READ: 'STATUS_READ',
  DEFAULT_POLICY_DECISION: 'DEFAULT_POLICY_DECISION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  MALFORMED_INPUT: 'MALFORMED_INPUT',
} as const;

export const DEMO_ORDERS = {
  PRIMARY_ORDER_ID: '1042',
  INITIAL_ADDRESS: '12 Market Road, Jaipur',
  PROPOSED_ADDRESS: '45 Office Park, Jaipur',
  INITIAL_STATUS: 'Out for delivery',
} as const;
