import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  Camera,
  Barcode,
  MessageSquare,
  Utensils,
  Server,
  Database,
  Cpu,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { adminClient } from '../api/adminClient';

export const DashboardView: React.FC = () => {
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => adminClient.getDashboardOverview(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-28 bg-zinc-900/60 border border-zinc-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 bg-zinc-900/40 border border-zinc-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-800/40 rounded-lg text-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-white">Failed to load operations metrics</h3>
        <p className="text-xs text-zinc-400 mt-1">
          {(error as any)?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const { business, product, operational, trendSeries } = overview;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Operations Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time telemetry, user engagement metrics, and infrastructure health across global
            regions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono">
            Updated: {new Date(overview.generatedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={() => refetch()}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* 1. Business Metrics Section */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
          <span>Business & Monetization</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total Registered Users</span>
              <Users className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {business.totalUsers.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>+{business.newRegistrationsToday} new today</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Premium Subscribers</span>
              <CreditCard className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {business.premiumSubscribers.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              <span>{business.freeUsers} free tier accounts</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Estimated MRR</span>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ${business.mrrEstimateUsd.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              <span>Monthly recurring run-rate</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Free to Paid Conversion</span>
              <TrendingUp className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {business.conversionRatePercent}%
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              <span>Benchmark: 3.5% - 5.0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visual Trends Chart */}
      {trendSeries && trendSeries.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white">14-Day Activity & Growth Trends</h2>
              <p className="text-xs text-zinc-400">Comparing signups, food scans, and meal logs</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
                <span className="text-zinc-300">Scans</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-400">Meals</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="text-zinc-500">Signups</span>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scansGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mealsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71717a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  itemStyle={{ color: '#fafafa' }}
                />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#scansGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="meals"
                  stroke="#71717a"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#mealsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Product & Feature Engagement */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <Utensils className="h-3.5 w-3.5 text-zinc-400" />
          <span>Product Usage & Features</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Daily Diary Entries</span>
              <Utensils className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {product.dailyDiaryEntries.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Meals logged today</div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">AI Photo Scans</span>
              <Camera className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {product.photoScansTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Lifetime photo recognitions</div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Barcode Scans</span>
              <Barcode className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {product.barcodeScansTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Packaged food lookups</div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Coach Conversations</span>
              <MessageSquare className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {product.coachMessagesTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">AI coaching interactions</div>
          </div>
        </div>
      </div>

      {/* 4. Infrastructure & Operational Telemetry */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-zinc-400" />
          <span>Operational Health & AI Telemetry</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">API Latency (p95)</span>
              <Clock className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {operational.p95LatencyMs} ms
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Avg: {operational.avgLatencyMs} ms • Err: {operational.errorRatePercent}%
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Database & Redis</span>
              <Database className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${operational.databaseStatus === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
              <span className="text-sm font-medium text-white capitalize">
                PG: {operational.databaseStatus}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Redis: {operational.redisStatus}</div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">BullMQ Worker Backlog</span>
              <Cpu className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {operational.workerQueueDepth}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Active: {operational.workerActiveJobs} • Failed: {operational.workerFailedJobs}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">AI Tokens & Est. Cost</span>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ${operational.aiEstimatedCostUsd.toFixed(3)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {operational.aiTotalTokens.toLocaleString()} tokens • Failures:{' '}
              {operational.aiFailureCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
