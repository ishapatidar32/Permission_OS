import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Send, CheckCircle2, AlertTriangle, XCircle, Clock, Package } from 'lucide-react';

interface TranscriptItem {
  id: string;
  prompt: string;
  tool?: string;
  args?: Record<string, unknown>;
  status: 'allowed' | 'approval_required' | 'denied' | 'error';
  message: string;
  correlationId?: string;
  approvalId?: string;
  timestamp: string;
}

export function Console() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [order1042, setOrder1042] = useState<any>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);

  const fetchOrder = () => {
    api.getOrder1042().then(setOrder1042).catch(console.error);
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  const handleRunPrompt = async (textToRun: string) => {
    if (!textToRun.trim() || loading) return;
    setLoading(true);
    const ts = new Date().toLocaleTimeString();

    try {
      const res = await api.sendIntent(textToRun);
      const mcpRes = res.mcpResponse?.result;
      const status = mcpRes?.status || (mcpRes?.order ? 'allowed' : 'allowed');
      const approvalId = mcpRes?.approvalId;

      let msg = '';
      if (status === 'allowed') {
        msg = mcpRes?.content?.[0]?.text || `Order status: ${mcpRes?.order?.status || 'Active'}`;
      } else if (status === 'approval_required') {
        msg = `Action held for human authorization. Ticket created: ${approvalId}`;
      } else if (status === 'denied') {
        msg = `Blocked by policy: ${mcpRes?.message || 'Access prohibited'}`;
      }

      const item: TranscriptItem = {
        id: `t_${Date.now()}`,
        prompt: textToRun,
        tool: res.selectedTool,
        args: res.args,
        status: status as any,
        message: msg,
        correlationId: res.correlationId,
        approvalId,
        timestamp: ts,
      };

      setTranscripts((prev) => [item, ...prev]);
      fetchOrder();
    } catch (err: any) {
      setTranscripts((prev) => [
        {
          id: `t_${Date.now()}`,
          prompt: textToRun,
          status: 'error',
          message: err.message || 'Invocation failed',
          timestamp: ts,
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Scenario Prompt Chips (PRD Section 6.2) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Run a governed action</h2>
          <p className="text-xs text-slate-400 mt-1">
            Test how the gateway evaluates an action before it can reach the order service.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Preset Scenario Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRunPrompt('Where is order 1042?')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/60 transition-colors"
            >
              🟢 Journey A: "Where is order 1042?" (Allow)
            </button>
            <button
              onClick={() =>
                handleRunPrompt("Update order 1042's delivery address to 45 Office Park, Jaipur")
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60 transition-colors"
            >
              🟡 Journey B: "Change address to 45 Office Park, Jaipur" (Approve)
            </button>
            <button
              onClick={() => handleRunPrompt("Export every customer's name and address")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/80 hover:bg-rose-900/60 transition-colors"
            >
              🔴 Journey C: "Export every customer's name and address" (Deny)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input + Transcript */}
        <div className="lg:col-span-2 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunPrompt(prompt);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask assistant or propose an action..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

          {/* Action Transcript */}
          <div className="space-y-3">
            {transcripts.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                No requests sent yet. Click a scenario chip above or enter a prompt.
              </div>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">{t.prompt}</span>
                    <span className="text-xs text-slate-500">{t.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.status === 'allowed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> ALLOWED
                      </span>
                    )}
                    {t.status === 'approval_required' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                        <Clock className="w-3 h-3" /> AWAITING APPROVAL
                      </span>
                    )}
                    {t.status === 'denied' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                        <XCircle className="w-3 h-3" /> BLOCKED
                      </span>
                    )}
                    {t.status === 'error' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                        <AlertTriangle className="w-3 h-3" /> ERROR
                      </span>
                    )}

                    {t.tool && (
                      <span className="font-mono text-xs text-sky-400 bg-sky-950/60 border border-sky-900/60 px-2 py-0.5 rounded">
                        {t.tool}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">{t.message}</p>

                  {t.args && Object.keys(t.args).length > 0 && (
                    <div className="bg-slate-950/80 rounded p-2 text-xs font-mono text-slate-400 overflow-x-auto">
                      <strong>Arguments:</strong> {JSON.stringify(t.args)}
                    </div>
                  )}

                  {t.approvalId && (
                    <div className="text-xs text-amber-400">
                      👉 View pending approval ticket{' '}
                      <a href="/approvals" className="underline font-semibold">
                        {t.approvalId} in Approval Inbox
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Order 1042 Live Status Card */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Live Synthetic Order 1042</h2>
              </div>
              <button
                onClick={fetchOrder}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Refresh
              </button>
            </div>

            {order1042 ? (
              <div className="space-y-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Customer:</span>{' '}
                  <strong className="text-white">{order1042.customer_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                    {order1042.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Destination:</span>
                  <div className="mt-1 font-mono text-white bg-slate-950 p-2 rounded border border-slate-800">
                    {order1042.address}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Version:</span>{' '}
                  <span className="font-mono text-indigo-300 font-semibold">{order1042.version}</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1">
                  Updated: {new Date(order1042.updated_at).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Loading order state...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default Console;
