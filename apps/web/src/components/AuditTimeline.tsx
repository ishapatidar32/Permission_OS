import React from 'react';

export interface AuditEntry {
  id: string;
  timestamp: string;
  caller: string;
  tool: string;
  decision: 'allow' | 'require_approval' | 'deny';
  policyMatched: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parameters: Record<string, unknown>;
}

export const AuditTimeline: React.FC<{ entries: AuditEntry[] }> = ({ entries }) => {
  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'allow':
        return <span style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>ALLOWED</span>;
      case 'require_approval':
        return <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>APPROVAL HELD</span>;
      case 'deny':
        return <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>BLOCKED</span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {entries.map((item) => (
        <div
          key={item.id}
          style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f4f4f5' }}>{item.tool}</span>
              {getDecisionBadge(item.decision)}
            </div>
            <div style={{ fontSize: '12px', color: '#71717a' }}>
              Caller: <strong>{item.caller}</strong> • Policy: <code>{item.policyMatched}</code>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#71717a' }}>
            <div>{new Date(item.timestamp).toLocaleTimeString()}</div>
            <div style={{ fontSize: '11px', color: '#52525b' }}>{new Date(item.timestamp).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
