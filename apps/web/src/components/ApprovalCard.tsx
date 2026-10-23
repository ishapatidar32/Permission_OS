import React from 'react';

export interface ApprovalRequest {
  id: string;
  toolName: string;
  callerId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parameters: Record<string, unknown>;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove?: () => void;
  onReject?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ request, onApprove, onReject }) => {
  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: getBadgeColor(request.riskLevel),
              color: '#fff',
            }}
          >
            {request.riskLevel} Risk
          </span>
          <h4 style={{ margin: '8px 0 2px', fontSize: '16px', color: '#f4f4f5' }}>{request.toolName}</h4>
          <span style={{ fontSize: '12px', color: '#71717a' }}>Caller: {request.callerId}</span>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: request.status === 'pending' ? '#eab308' : request.status === 'approved' ? '#22c55e' : '#ef4444',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {request.status}
        </span>
      </div>

      <div style={{ background: '#09090b', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
        <div style={{ color: '#a1a1aa', marginBottom: '4px' }}>Requested Parameters:</div>
        <pre style={{ margin: 0, overflowX: 'auto', color: '#e4e4e7', fontFamily: 'monospace' }}>
          {JSON.stringify(request.parameters, null, 2)}
        </pre>
      </div>

      {request.status === 'pending' && onApprove && onReject && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Approve Action
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};
