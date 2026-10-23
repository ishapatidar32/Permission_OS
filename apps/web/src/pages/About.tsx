import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function About() {
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    api.getCurrentPolicies().then(setPolicy).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 text-slate-300">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">About PermissionOS</h1>
        <p className="mt-2 text-slate-400">
          The Human Approval Layer for AI Agents & Model Context Protocol (MCP) Gateway.
        </p>
      </div>

      <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 text-sm text-amber-200">
        <strong className="text-amber-100">Simulated Alexa+-Style Experience Disclaimer:</strong> This application demonstrates an Alexa+-style voice and natural-language assistant managing a synthetic order fulfillment system through a self-hosted Model Context Protocol (MCP) gateway. It is not affiliated with or endorsed by Amazon.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Runtime Architecture</h2>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">MCP Spec:</strong> 2025-11-25 Streamable HTTP transport</li>
            <li><strong className="text-white">Runtime:</strong> Node.js 22+, Express, official MCP TypeScript SDK</li>
            <li><strong className="text-white">Policy Engine:</strong> Deterministic <code>mcp-policy-kit</code> module</li>
            <li><strong className="text-white">Storage:</strong> SQLite with WAL mode & foreign keys</li>
          </ul>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Security Boundaries</h2>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">Default Deny:</strong> Any unmapped tool or role is blocked immediately.</li>
            <li><strong className="text-white">Isolated Upstream:</strong> Public clients cannot bypass gateway to call downstream tools.</li>
            <li><strong className="text-white">No Self-Approval:</strong> Operators cannot approve their own requests.</li>
            <li><strong className="text-white">Idempotency:</strong> Replay protection via stable actionId and optimistic concurrency.</li>
          </ul>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Active Declarative Policy ({policy?.version || '2026-10-22.1'})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800 text-slate-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">Tool Name</th>
                <th className="p-3">Effect</th>
                <th className="p-3">Authorized Roles</th>
                <th className="p-3">Reason Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {policy?.rules?.map((rule: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono text-xs text-sky-400">{rule.tool}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        rule.effect === 'allow'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : rule.effect === 'approve'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {rule.effect.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{rule.roles?.join(', ') || 'Any'}</td>
                  <td className="p-3 font-mono text-xs text-slate-400">{rule.reasonCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
