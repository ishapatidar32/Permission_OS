import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { RefreshCw, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';

export function AuditLogs() {
  const [events, setEvents] = useState<any[]>([]);
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(100);
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = events.filter((ev) => {
    if (filterDecision === 'all') return true;
    return ev.decision === filterDecision;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">
            Structured, attributable audit events linking correlation IDs, actors, policies, decisions, and execution outcomes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Decisions</option>
            <option value="allow">Allowed</option>
            <option value="approve">Approval Required</option>
            <option value="deny">Denied</option>
          </select>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Event Type</th>
                <th className="p-3.5">Decision</th>
                <th className="p-3.5">Tool</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Reason Code</th>
                <th className="p-3.5">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 text-slate-400 font-sans">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 text-indigo-300 font-semibold">{item.event_type}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.decision === 'allow'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : item.decision === 'approve'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {item.decision.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 text-sky-400">{item.tool_name}</td>
                    <td className="p-3.5 text-slate-300">{item.actor_id}</td>
                    <td className="p-3.5 text-slate-400">{item.reason_code}</td>
                    <td className="p-3.5 text-slate-500 text-[11px]">{item.correlation_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default AuditLogs;
