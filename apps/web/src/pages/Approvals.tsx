import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CheckCircle2, XCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';

export function Approvals() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const data = await api.getApprovals(activeTab === 'pending' ? 'pending' : undefined);
      setApprovals(data || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeTab]);

  const handleDecision = async (approvalId: string, decision: 'approve' | 'reject') => {
    if (decision === 'approve' && !confirm('Confirm authorization to execute this mutation downstream?')) {
      return;
    }
    setActionInProgress(approvalId);
    try {
      await api.resolveApproval(approvalId, decision);
      await fetchApprovals();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredApprovals = approvals.filter((a) =>
    activeTab === 'pending' ? a.status === 'pending' : a.status !== 'pending'
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Approval Inbox</h1>
          <p className="text-xs text-slate-400 mt-1">
            Human-in-the-loop review queue for sensitive tool invocations requiring supervisor authorization.
          </p>
        </div>

        <button
          onClick={fetchApprovals}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 font-medium transition-colors border-b-2 ${
            activeTab === 'pending'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Pending Approvals
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`pb-3 font-medium transition-colors border-b-2 ${
            activeTab === 'resolved'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Resolved History
        </button>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-10 text-center text-slate-500 text-sm">
            {activeTab === 'pending'
              ? 'No pending approvals requiring review.'
              : 'No resolved approval history yet.'}
          </div>
        ) : (
          filteredApprovals.map((item) => {
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(item.args_json);
            } catch (e) {
              parsedArgs = {};
            }

            return (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-2 py-0.5 rounded">
                      {item.id}
                    </span>
                    <span className="text-xs font-mono text-sky-400">{item.tool_name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                        item.status === 'pending'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : item.status === 'executed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500">
                    Created: {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Target Order ID:</span>{' '}
                    <strong className="text-white font-mono">{parsedArgs.orderId || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Proposed Address:</span>{' '}
                    <strong className="text-white font-mono">{parsedArgs.address || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Immutable Action ID:</span>{' '}
                    <span className="font-mono text-slate-400 text-[11px]">{item.action_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Expires At:</span>{' '}
                    <span className="text-slate-400">{new Date(item.expires_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {item.status === 'pending' && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => handleDecision(item.id, 'reject')}
                      disabled={actionInProgress === item.id}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 hover:bg-rose-900/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleDecision(item.id, 'approve')}
                      disabled={actionInProgress === item.id}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Execute</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export default Approvals;
