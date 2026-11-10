import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const ScanOperationsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [inspectingScanId, setInspectingScanId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'scans', page, statusFilter],
    queryFn: () =>
      adminClient.listScans({
        page,
        limit: 15,
        status: statusFilter,
      }),
  });

  const { data: scanDetails } = useQuery({
    queryKey: ['admin', 'scan', inspectingScanId],
    queryFn: () => adminClient.getScanDetails(inspectingScanId!),
    enabled: !!inspectingScanId,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => adminClient.retryScan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scans'] });
    },
  });

  const scans = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
            <CheckCircle className="h-3 w-3" />
            <span>Completed</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-red-400 font-medium text-[11px]">
            <AlertTriangle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-zinc-400 text-[11px]">
            <Clock className="h-3 w-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Food Scan Operations & AI Debugger
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor real-time food recognition jobs, inspect model inference latencies, debug
            recognition errors, and trigger safe job retries.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Scan Statuses</option>
            <option value="FAILED">Failed Scans Only</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="PENDING">Pending / Queued</option>
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Scans Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Model & Provider</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4">Items / Failure</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  Loading scan records...
                </td>
              </tr>
            ) : scans.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  No scan operations match the selected criteria.
                </td>
              </tr>
            ) : (
              scans.map((s: any) => (
                <tr key={s.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">{s.userEmail}</td>
                  <td className="py-3 px-4">{getStatusBadge(s.status)}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                    {s.provider} / {s.model}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                    {s.latencyMs} ms
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    {s.status === 'FAILED' ? (
                      <span className="text-red-400 line-clamp-1">
                        {s.errorMessage || s.failureReason || 'Inference error'}
                      </span>
                    ) : (
                      <span className="text-zinc-400">{s.detectedItemsCount} detected items</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                    {new Date(s.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => setInspectingScanId(s.id)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white"
                      title="Inspect Raw Response Payload"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {s.status === 'FAILED' && (
                      <button
                        onClick={() => retryMutation.mutate(s.id)}
                        disabled={retryMutation.isPending}
                        className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-white"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950">
          <div>
            Showing page {pagination.page} of {Math.max(1, pagination.totalPages)} (
            {pagination.total} scans)
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

      {/* Inspect Raw Scan Modal */}
      {inspectingScanId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-xl h-full overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-semibold text-white text-sm">AI Scan Inference Payload</h3>
                <p className="text-zinc-500 font-mono text-[11px]">{inspectingScanId}</p>
              </div>
              <button
                onClick={() => setInspectingScanId(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {scanDetails ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="bg-zinc-900/60 p-3 rounded border border-zinc-850 space-y-1">
                  <div>Status: {scanDetails.status}</div>
                  <div>Latency: {scanDetails.latencyMs} ms</div>
                  <div>
                    Tokens: Prompt {scanDetails.promptTokens || 0} • Comp{' '}
                    {scanDetails.completionTokens || 0}
                  </div>
                  {scanDetails.errorMessage && (
                    <div className="text-red-400 mt-2">Error: {scanDetails.errorMessage}</div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-1">Detected Items:</h4>
                  <pre className="p-3 bg-zinc-900 rounded border border-zinc-850 overflow-x-auto text-[11px] text-zinc-300">
                    {JSON.stringify(scanDetails.detectedItems, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-1">Nutrition Calculation Output:</h4>
                  <pre className="p-3 bg-zinc-900 rounded border border-zinc-850 overflow-x-auto text-[11px] text-zinc-300">
                    {JSON.stringify(scanDetails.nutritionResult, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 text-xs py-8 text-center">Loading payload data...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
