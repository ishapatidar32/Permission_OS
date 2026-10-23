import React, { useState } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  toolCall?: {
    name: string;
    params: Record<string, unknown>;
    status: 'pending' | 'allowed' | 'approval_required' | 'denied';
  };
}

export const ChatPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      sender: 'agent',
      content: 'Hello! I am connected via the PermissionOS gateway. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate Agent action
    setTimeout(() => {
      const isHighRisk = input.toLowerCase().includes('refund');
      const agentMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        sender: 'agent',
        content: isHighRisk
          ? 'I am attempting to execute a refund. It has been held by PermissionOS for supervisor sign-off.'
          : 'I have retrieved the requested information through the gateway.',
        toolCall: {
          name: isHighRisk ? 'orders:refund_order' : 'orders:get_order',
          params: isHighRisk ? { amount: 150, orderId: 'ord_123' } : { orderId: 'ord_123' },
          status: isHighRisk ? 'approval_required' : 'allowed',
        },
      };
      setMessages((prev) => [...prev, agentMsg]);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '560px', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.sender === 'user' ? '#2563eb' : '#18181b',
              color: '#fafafa',
              padding: '12px 16px',
              borderRadius: '8px',
              border: m.sender === 'user' ? 'none' : '1px solid #27272a',
            }}
          >
            <div>{m.content}</div>
            {m.toolCall && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#000', borderRadius: '4px', fontSize: '12px', border: '1px solid #333' }}>
                <span style={{ color: '#a1a1aa' }}>Tool:</span> <code>{m.toolCall.name}</code>
                <div style={{ marginTop: '4px', color: m.toolCall.status === 'allowed' ? '#22c55e' : '#f59e0b' }}>
                  Status: <strong>{m.toolCall.status.toUpperCase()}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', padding: '12px', background: '#18181b', borderTop: '1px solid #27272a', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask agent to perform actions (e.g. 'refund order #9981')..."
          style={{ flex: 1, background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff', padding: '8px 12px' }}
        />
        <button
          onClick={handleSend}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
        >
          Send
        </button>
      </div>
    </div>
  );
};
