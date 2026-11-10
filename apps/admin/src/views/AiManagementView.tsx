import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Cpu, Clock, DollarSign, AlertTriangle, Server, Layers } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const AiManagementView: React.FC = () => {
  const {
    data: telemetry,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'ai', 'telemetry'],
    queryFn: () => adminClient.getAiTelemetry(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="text-center py-16 text-zinc-500 text-xs">Loading AI telemetry...</div>;
  }

  if (!telemetry) {
    return (
      <div className="text-center py-16 text-zinc-500 text-xs">Failed to fetch AI telemetry.</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            AI Model Management & Cost Telemetry
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor Google Gemini model inferences, prompt/completion token consumption, latency
            distribution, and operational expenditure.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300 self-start sm:self-auto"
        >
          Refresh Telemetry
        </button>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Estimated Monthly Cost</span>
            <DollarSign className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            ${telemetry.estimatedCostUsd}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Based on Gemini Flash pricing</div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Total Token Volume</span>
            <Cpu className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {telemetry.totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Prompt: {telemetry.totalPromptTokens.toLocaleString()} • Comp:{' '}
            {telemetry.totalCompletionTokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Average Inference Latency</span>
            <Clock className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {telemetry.averageLatencyMs} ms
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Within optimal SLA (&lt; 1500 ms)</div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Inference Failure Rate</span>
            <AlertTriangle className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {telemetry.failureRatePercent}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {telemetry.failedCalls} failed executions
          </div>
        </div>
      </div>

      {/* Model Provisioning and Routing Configuration */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Active Production Models & Providers
            </h2>
            <p className="text-xs text-zinc-400">Deterministic fallback and routing strategy</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px] font-mono">
            Provider: Google AI Studio / Vertex
          </span>
        </div>

        <div className="divide-y divide-zinc-850 text-xs">
          {telemetry.providerBreakdown.map((item: any) => (
            <div key={item.model} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-white font-mono">{item.model}</div>
                  <div className="text-[11px] text-zinc-500 capitalize">
                    Provider: {item.provider}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-mono text-zinc-300">{item.usageSharePercent}% share</div>
                  <div className="text-[11px] text-zinc-500">Traffic distribution</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 capitalize">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workload Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Layers className="h-4 w-4 text-zinc-400" />
            <span>AI Recognition Workload Breakdown</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-400">Total Scan Inferences:</span>
              <span className="font-mono text-white">{telemetry.scanCalls.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-400">Coach Dialogue Inferences:</span>
              <span className="font-mono text-white">{telemetry.coachCalls.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Total AI Pipeline Executions:</span>
              <span className="font-mono text-white font-bold">
                {telemetry.totalCalls.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Server className="h-4 w-4 text-zinc-400" />
            <span>Cost Management Policy</span>
          </div>
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            CAL METER utilizes Gemini 2.5 Flash for multimodal food recognition and real-time
            coaching responses. Token limits are capped per request to ensure strict operational
            budget adherence while keeping accuracy high for Indian and international foods.
          </p>
        </div>
      </div>
    </div>
  );
};
