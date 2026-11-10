import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, X, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const NotificationCampaignsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Campaign Form
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    body: '',
    category: 'DAILY_SUMMARY' as any,
    targetAudience: 'ALL' as 'ALL' | 'FREE_TIER' | 'PREMIUM_TIER',
    deepLink: 'calmeter://home',
  });

  // Test Push Form
  const [testForm, setTestForm] = useState({
    title: 'CAL METER Test Notification',
    body: 'Verifying FCM push notification deliverability and quiet hours policy.',
    token: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'campaigns', page],
    queryFn: () => adminClient.listCampaigns({ page, limit: 12 }),
  });

  const createMutation = useMutation({
    mutationFn: (newCampaign: any) => adminClient.createCampaign(newCampaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      setIsCreating(false);
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => adminClient.dispatchCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (testData: any) => adminClient.testNotification(testData),
    onSuccess: () => {
      alert('Test push notification successfully sent!');
      setIsTesting(false);
    },
  });

  const campaigns = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Push Notification Campaigns
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Broadcast targeted reminders, seasonal nutrition updates, and re-engagement push
            notifications across devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTesting(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-xs rounded transition-colors"
          >
            <Smartphone className="h-4 w-4" />
            <span>Send Test Push</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-medium text-xs rounded transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">Title & Message</th>
              <th className="py-3 px-4">Audience</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Deliveries</th>
              <th className="py-3 px-4">Scheduled / Sent</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  Loading campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  No notification campaigns created yet. Click 'Create Campaign' to schedule one.
                </td>
              </tr>
            ) : (
              campaigns.map((c: any) => (
                <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{c.title}</div>
                    <div className="text-[11px] text-zinc-400 line-clamp-1">{c.body}</div>
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-mono text-[11px]">
                    {c.targetAudience}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        c.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-zinc-850 text-zinc-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                    {c.totalSent} sent ({c.totalFailed} failed)
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                    {c.sentAt ? new Date(c.sentAt).toLocaleString() : 'Not dispatched'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {c.status !== 'COMPLETED' && (
                      <button
                        onClick={() => dispatchMutation.mutate(c.id)}
                        disabled={dispatchMutation.isPending}
                        className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black font-medium rounded text-[11px] flex items-center gap-1.5 ml-auto"
                      >
                        <Send className="h-3 w-3" />
                        <span>Dispatch Now</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950">
          <div>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)}
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

      {/* Create Campaign Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm">Create Push Campaign</h3>
              <button
                onClick={() => setIsCreating(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate(campaignForm);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Notification Title *</label>
                <input
                  type="text"
                  required
                  value={campaignForm.title}
                  onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  placeholder="e.g. Log your dinner before 9 PM"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Notification Message Body *</label>
                <textarea
                  required
                  value={campaignForm.body}
                  onChange={e => setCampaignForm({ ...campaignForm, body: e.target.value })}
                  rows={3}
                  placeholder="Keep up your calorie deficit streak with one quick photo scan..."
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Target Audience</label>
                  <select
                    value={campaignForm.targetAudience}
                    onChange={e =>
                      setCampaignForm({ ...campaignForm, targetAudience: e.target.value as any })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                  >
                    <option value="ALL">All Active Users</option>
                    <option value="FREE_TIER">Free Users Only (Promo)</option>
                    <option value="PREMIUM_TIER">Premium Subscribers Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Deep Link Route</label>
                  <input
                    type="text"
                    value={campaignForm.deepLink}
                    onChange={e => setCampaignForm({ ...campaignForm, deepLink: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 rounded bg-white text-black font-medium text-xs disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save as Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Push Modal */}
      {isTesting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm">Send Test Push to Device</h3>
              <button
                onClick={() => setIsTesting(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                testMutation.mutate(testForm);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={testForm.title}
                  onChange={e => setTestForm({ ...testForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Body</label>
                <textarea
                  required
                  value={testForm.body}
                  onChange={e => setTestForm({ ...testForm, body: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">FCM Device Token (Optional)</label>
                <input
                  type="text"
                  value={testForm.token}
                  onChange={e => setTestForm({ ...testForm, token: e.target.value })}
                  placeholder="Device token or leave blank for mock provider test"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTesting(false)}
                  className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testMutation.isPending}
                  className="px-4 py-1.5 rounded bg-white text-black font-medium text-xs disabled:opacity-50"
                >
                  {testMutation.isPending ? 'Sending...' : 'Send Test Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
