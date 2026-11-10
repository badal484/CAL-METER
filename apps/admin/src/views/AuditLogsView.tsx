import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const AuditLogsView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'audit-logs', page, actionFilter, resourceFilter],
    queryFn: () =>
      adminClient.listAuditLogs({
        page,
        limit: 20,
        action: actionFilter.trim() || undefined,
        targetResource: resourceFilter.trim() || undefined,
      }),
  });

  const logs = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Immutable Security & Operations Audit Trail
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Append-only, cryptographically verifiable ledger tracking every privileged
            administrative action, actor identity, and reason.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Tamper-Resistant Storage Active</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by action (e.g. USER_SUSPEND)..."
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-500 font-mono w-64"
          />

          <select
            value={resourceFilter}
            onChange={e => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            <option value="">All Target Resources</option>
            <option value="user">user</option>
            <option value="food_item">food_item</option>
            <option value="recipe">recipe</option>
            <option value="admin_user">admin_user</option>
            <option value="notification_campaign">notification_campaign</option>
            <option value="support_ticket">support_ticket</option>
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Filter Logs
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Admin Operator</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target Resource</th>
              <th className="py-3 px-4">Reason / Justification</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  Loading immutable audit events...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  No audit log events found matching the specified parameters.
                </td>
              </tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{log.adminName || 'Admin'}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{log.adminEmail}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-white">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    {log.targetResource}
                    {log.targetId ? `:${log.targetId.slice(0, 8)}...` : ''}
                  </td>
                  <td className="py-3 px-4 text-[11px] text-zinc-300 max-w-xs truncate">
                    {log.reason || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-zinc-500">
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white"
                      title="Inspect Full Audit Record"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950">
          <div>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total} audit
            events)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Log Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-lg h-full overflow-y-auto p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-semibold text-white text-sm">Audit Event Record</h3>
                <p className="text-zinc-500 text-[11px]">{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 bg-zinc-900/60 p-4 rounded border border-zinc-850">
              <div>
                Action: <span className="text-white font-bold">{selectedLog.action}</span>
              </div>
              <div>
                Actor: {selectedLog.adminName} ({selectedLog.adminEmail})
              </div>
              <div>Target Resource: {selectedLog.targetResource}</div>
              <div>Target UUID: {selectedLog.targetId || 'N/A'}</div>
              <div>Timestamp: {selectedLog.createdAt}</div>
              {selectedLog.reason && (
                <div className="text-amber-300">Reason: {selectedLog.reason}</div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">
                State Mutation Diff / Payload Details:
              </h4>
              <pre className="p-3 bg-zinc-900 rounded border border-zinc-850 overflow-x-auto text-[11px] text-zinc-300">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
