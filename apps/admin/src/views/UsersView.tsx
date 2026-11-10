import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserCheck,
  UserX,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldAlert,
} from 'lucide-react';
import { adminClient } from '../api/adminClient';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRole, hasRequiredAdminRole } from '@calmeter/shared';

export const UsersView: React.FC = () => {
  const queryClient = useQueryClient();
  const { admin } = useAdminAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [suspendingUser, setSuspendingUser] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [reactivatingUser, setReactivatingUser] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search, statusFilter, tierFilter],
    queryFn: () =>
      adminClient.listUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: statusFilter,
        tier: tierFilter,
      }),
  });

  const { data: userDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['admin', 'user', selectedUserId],
    queryFn: () => adminClient.getUserDetails(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminClient.suspendUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSuspendingUser(null);
      setSuspensionReason('');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      adminClient.reactivateUser(id, 'Reactivated from admin operations console'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setReactivatingUser(null);
    },
  });

  const canSuspend = admin ? hasRequiredAdminRole(admin.role, AdminRole.OPERATIONS_ADMIN) : false;

  const users = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">User Directory</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage subscriber accounts, inspect health telemetry profiles, and handle account
            suspensions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email, name, or UUID..."
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">Status: All</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>

          <select
            value={tierFilter}
            onChange={e => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">Tier: All</option>
            <option value="free">Free Tier</option>
            <option value="premium">Premium Tier</option>
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Subscription</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Engagement</th>
              <th className="py-3 px-4">Joined</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  Loading user records...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  No user records found matching the specified filters.
                </td>
              </tr>
            ) : (
              users.map((u: any) => (
                <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{u.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        u.tier === 'PREMIUM'
                          ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      {u.tier}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.isSuspended ? (
                      <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                        <UserX className="h-3.5 w-3.5" />
                        <span>Suspended</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Active</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-[11px] space-x-2">
                    <span>{u.mealsCount} meals</span>
                    <span>•</span>
                    <span>{u.scansCount} scans</span>
                    <span>•</span>
                    <span>{u.ticketsCount} tickets</span>
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors"
                      title="Inspect User Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {canSuspend && (
                      <>
                        {u.isSuspended ? (
                          <button
                            onClick={() => setReactivatingUser(u)}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-emerald-400 transition-colors"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => setSuspendingUser(u)}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-red-400 transition-colors"
                          >
                            Suspend
                          </button>
                        )}
                      </>
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
            {pagination.total} records)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      {suspendingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Confirm Account Suspension</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Are you sure you want to suspend{' '}
              <span className="text-white font-medium">{suspendingUser.email}</span>? Suspended
              users are immediately blocked from logging in, scanning food, and fetching AI
              recommendations.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Mandatory Audit Suspension Reason
              </label>
              <textarea
                value={suspensionReason}
                onChange={e => setSuspensionReason(e.target.value)}
                placeholder="Specify the policy violation or reason for audit logs..."
                rows={3}
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendingUser(null)}
                className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!suspensionReason.trim() || suspendMutation.isPending}
                onClick={() =>
                  suspendMutation.mutate({ id: suspendingUser.id, reason: suspensionReason.trim() })
                }
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-medium text-xs disabled:opacity-50"
              >
                {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Confirmation Modal */}
      {reactivatingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <UserCheck className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Reactivate Account</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Reactivate <span className="text-white font-medium">{reactivatingUser.email}</span>{' '}
              and restore full access to CAL METER services?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReactivatingUser(null)}
                className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reactivateMutation.isPending}
                onClick={() => reactivateMutation.mutate(reactivatingUser.id)}
                className="px-3 py-1.5 rounded bg-white hover:bg-zinc-200 text-black font-medium text-xs disabled:opacity-50"
              >
                {reactivateMutation.isPending ? 'Restoring...' : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Drawer Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-xl h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">User Inspection Profile</h3>
                <p className="text-xs text-zinc-500 font-mono">{selectedUserId}</p>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                Loading complete user profile...
              </div>
            ) : userDetails ? (
              <div className="space-y-6 text-xs">
                {/* Account Summary */}
                <div className="bg-zinc-900/50 p-4 rounded border border-zinc-850 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Name / Email:</span>
                    <span className="text-white font-medium">
                      {userDetails.name || 'Anonymous'} ({userDetails.email})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Subscription Tier:</span>
                    <span className="text-white font-medium capitalize">
                      {userDetails.subscription?.tier || 'FREE'} (
                      {userDetails.subscription?.status || 'NONE'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Timezone:</span>
                    <span className="text-white font-mono">
                      {userDetails.profile?.timezone || 'Asia/Kolkata'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Weight Profile:</span>
                    <span className="text-white">
                      Current: {userDetails.profile?.currentWeightKg || '—'} kg • Target:{' '}
                      {userDetails.profile?.targetWeightKg || '—'} kg
                    </span>
                  </div>
                </div>

                {/* Nutrition Goals */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Nutrition Targets</h4>
                  {userDetails.goals && userDetails.goals.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-zinc-900 p-2 rounded border border-zinc-850">
                        <div className="text-[10px] text-zinc-500">Calories</div>
                        <div className="font-bold text-white">
                          {userDetails.goals[0].dailyCalories} kcal
                        </div>
                      </div>
                      <div className="bg-zinc-900 p-2 rounded border border-zinc-850">
                        <div className="text-[10px] text-zinc-500">Protein</div>
                        <div className="font-bold text-white">
                          {Number(userDetails.goals[0].proteinGrams)}g
                        </div>
                      </div>
                      <div className="bg-zinc-900 p-2 rounded border border-zinc-850">
                        <div className="text-[10px] text-zinc-500">Carbs</div>
                        <div className="font-bold text-white">
                          {Number(userDetails.goals[0].carbsGrams)}g
                        </div>
                      </div>
                      <div className="bg-zinc-900 p-2 rounded border border-zinc-850">
                        <div className="text-[10px] text-zinc-500">Fat</div>
                        <div className="font-bold text-white">
                          {Number(userDetails.goals[0].fatGrams)}g
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-500">No active goal profile recorded.</p>
                  )}
                </div>

                {/* Recent Scans */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Recent AI Food Scans</h4>
                  <div className="space-y-2">
                    {userDetails.scans && userDetails.scans.length > 0 ? (
                      userDetails.scans.map((s: any) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded bg-zinc-900/40 border border-zinc-850 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium text-white">
                              {s.mealType || 'UNSPECIFIED'} Scan
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              Status: {s.status} • {s.latencyMs} ms
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-500">No scans logged by this user.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
