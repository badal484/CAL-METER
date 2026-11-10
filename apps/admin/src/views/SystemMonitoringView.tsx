import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Clock, HardDrive, CheckCircle, AlertTriangle } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const SystemMonitoringView: React.FC = () => {
  const {
    data: health,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'system', 'health'],
    queryFn: () => adminClient.getSystemHealth(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="text-center py-16 text-zinc-500 text-xs">
        Inspecting system infrastructure...
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-16 text-zinc-500 text-xs">
        Failed to fetch infrastructure telemetry.
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            System Infrastructure & Telemetry
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time health telemetry across PostgreSQL instances, Redis message brokers, BullMQ
            asynchronous workers, and memory footprint.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telemetry Stream Active</span>
          </span>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Services Connectivity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(health.services).map(([key, service]: [string, any]) => (
          <div key={key} className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{service.name}</span>
              {service.status === 'ONLINE' ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-white">{service.status}</span>
              <span className="text-xs text-zinc-500 font-mono">
                ({service.latencyMs} ms latency)
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Role: Primary Production Cluster
            </div>
          </div>
        ))}
      </div>

      {/* BullMQ Asynchronous Queues */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">
              BullMQ Asynchronous Background Queues
            </h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Redis Queue Broker</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded bg-zinc-900/60 border border-zinc-850">
            <div className="text-xs text-zinc-400 mb-1">Active Executing Jobs</div>
            <div className="text-2xl font-bold font-mono text-white">
              {health.queues.activeJobs}
            </div>
          </div>
          <div className="p-4 rounded bg-zinc-900/60 border border-zinc-850">
            <div className="text-xs text-zinc-400 mb-1">Waiting in Queue</div>
            <div className="text-2xl font-bold font-mono text-white">
              {health.queues.waitingJobs}
            </div>
          </div>
          <div className="p-4 rounded bg-zinc-900/60 border border-zinc-850">
            <div className="text-xs text-zinc-400 mb-1">Completed Jobs</div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {health.queues.completedJobs}
            </div>
          </div>
          <div className="p-4 rounded bg-zinc-900/60 border border-zinc-850">
            <div className="text-xs text-zinc-400 mb-1">Failed Jobs</div>
            <div className="text-2xl font-bold font-mono text-red-400">
              {health.queues.failedJobs}
            </div>
          </div>
        </div>
      </div>

      {/* Memory and Process Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <HardDrive className="h-4 w-4 text-zinc-400" />
            <span>Process Memory Footprint</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>V8 Heap Used:</span>
                <span className="font-mono text-white">{health.memory.heapUsedMb} MB</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width: `${Math.min(100, (health.memory.heapUsedMb / health.memory.heapTotalMb) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-850">
              <span>Resident Set Size (RSS):</span>
              <span className="font-mono text-white">{health.memory.rssMb} MB</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-xs">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span>Process Lifetime & Uptime</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-850">
              <span className="text-zinc-400">Continuous Process Uptime:</span>
              <span className="font-mono text-white font-bold">
                {formatUptime(health.uptimeSeconds)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-850">
              <span className="text-zinc-400">Total Running Seconds:</span>
              <span className="font-mono text-white">
                {health.uptimeSeconds.toLocaleString()} s
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Host Environment:</span>
              <span className="font-mono text-zinc-300">
                Node.js {process.version || 'v20.x'} on Linux/Darwin
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
