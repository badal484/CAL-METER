import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const SubscriptionManagementView: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'webhooks'>('subscriptions');
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState('ALL');

  const {
    data: subData,
    isLoading: subLoading,
    refetch: refetchSubs,
  } = useQuery({
    queryKey: ['admin', 'subscriptions', page, tierFilter],
    queryFn: () =>
      adminClient.listSubscriptions({
        page,
        limit: 15,
        tier: tierFilter,
      }),
    enabled: activeTab === 'subscriptions',
  });

  const { data: webhookData, isLoading: webhookLoading } = useQuery({
    queryKey: ['admin', 'webhooks', page],
    queryFn: () => adminClient.listWebhooks({ page, limit: 15 }),
    enabled: activeTab === 'webhooks',
  });

  const reconcileMutation = useMutation({
    mutationFn: (id: string) => adminClient.reconcileSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    },
  });

  const subscriptions = subData?.data || [];
  const subPagination = subData?.pagination || { page: 1, totalPages: 1, total: 0 };

  const webhooks = webhookData?.data || [];
  const webhookPagination = webhookData?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Subscription Management & Ingestion Audit
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit RevenueCat subscription lifecycles, inspect store platform billing events, and
            trigger manual entitlement reconciliations.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 flex gap-4 text-xs font-medium">
        <button
          onClick={() => {
            setActiveTab('subscriptions');
            setPage(1);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Active Entitlements</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('webhooks');
            setPage(1);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'webhooks'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>RevenueCat Webhook Audit Trail</span>
        </button>
      </div>

      {activeTab === 'subscriptions' ? (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={tierFilter}
                onChange={e => {
                  setTierFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
              >
                <option value="ALL">All Tiers</option>
                <option value="PREMIUM">Premium Subscribers</option>
                <option value="FREE">Free Tier</option>
              </select>

              <button
                onClick={() => refetchSubs()}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
                  <th className="py-3 px-4">User Email</th>
                  <th className="py-3 px-4">Tier & Status</th>
                  <th className="py-3 px-4">Store Platform</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4">Auto-Renew</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {subLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-zinc-500">
                      Loading subscriptions...
                    </td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-zinc-500">
                      No active subscription records found.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-white">{s.userEmail}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            s.tier === 'PREMIUM'
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                              : 'bg-zinc-900 text-zinc-400'
                          }`}
                        >
                          {s.tier} • {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 capitalize">{s.store}</td>
                      <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                        {s.currentPeriodExpiresAt
                          ? new Date(s.currentPeriodExpiresAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {!s.cancelAtPeriodEnd ? 'Enabled' : 'Cancelling at period end'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => reconcileMutation.mutate(s.id)}
                          disabled={reconcileMutation.isPending}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-zinc-300"
                        >
                          Reconcile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div>
                Page {subPagination.page} of {Math.max(1, subPagination.totalPages)}
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
                  disabled={page >= subPagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">App User ID</th>
                <th className="py-3 px-4">Product ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {webhookLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500">
                    Loading webhook log events...
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500">
                    No RevenueCat webhook payloads recorded.
                  </td>
                </tr>
              ) : (
                webhooks.map((w: any) => (
                  <tr key={w.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{w.eventId}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-white">{w.eventType}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{w.appUserId}</td>
                    <td className="py-3 px-4 text-zinc-300">{w.productId || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                        {w.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                      {new Date(w.eventTimestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <div>
              Page {webhookPagination.page} of {Math.max(1, webhookPagination.totalPages)}
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
                disabled={page >= webhookPagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
