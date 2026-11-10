import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Lock, X, CheckCircle } from 'lucide-react';
import { adminClient } from '../api/adminClient';
import { AdminRole } from '@calmeter/shared';

export const AdminManagementView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    name: '',
    email: '',
    role: AdminRole.SUPPORT_ADMIN,
  });

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => adminClient.listAdmins(),
  });

  const provisionMutation = useMutation({
    mutationFn: (newAdmin: any) => adminClient.provisionAdmin(newAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      setIsProvisioning(false);
      setProvisionForm({ name: '', email: '', role: AdminRole.SUPPORT_ADMIN });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) =>
      adminClient.updateAdminRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminClient.toggleAdminStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Administrator Role & Access Governance
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Super Administrator privilege zone: Provision authorized operators, assign granular RBAC
            roles, and manage account statuses.
          </p>
        </div>
        <button
          onClick={() => setIsProvisioning(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-medium text-xs rounded transition-colors self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Provision New Administrator</span>
        </button>
      </div>

      {/* Admin Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">Operator Name</th>
              <th className="py-3 px-4">Email Address</th>
              <th className="py-3 px-4">Assigned RBAC Role</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  Loading administrator accounts...
                </td>
              </tr>
            ) : !admins || admins.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  No administrators registered.
                </td>
              </tr>
            ) : (
              admins.map((a: any) => (
                <tr key={a.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 font-medium text-white">{a.name}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{a.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={a.role}
                      onChange={e =>
                        updateRoleMutation.mutate({
                          id: a.id,
                          role: e.target.value as AdminRole,
                        })
                      }
                      className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none"
                    >
                      <option value={AdminRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                      <option value={AdminRole.OPERATIONS_ADMIN}>OPERATIONS_ADMIN</option>
                      <option value={AdminRole.NUTRITION_EDITOR}>NUTRITION_EDITOR</option>
                      <option value={AdminRole.SUPPORT_ADMIN}>SUPPORT_ADMIN</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    {a.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                        <CheckCircle className="h-3 w-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400 text-[11px] font-medium">
                        <Lock className="h-3 w-3" />
                        <span>Disabled</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                    {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({ id: a.id, isActive: !a.isActive })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-zinc-300"
                    >
                      {a.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Provision Modal */}
      {isProvisioning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm">Provision New Administrator</h3>
              <button
                onClick={() => setIsProvisioning(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                provisionMutation.mutate(provisionForm);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={provisionForm.name}
                  onChange={e => setProvisionForm({ ...provisionForm, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  value={provisionForm.email}
                  onChange={e => setProvisionForm({ ...provisionForm, email: e.target.value })}
                  placeholder="name@calmeter.app"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Administrative Role *</label>
                <select
                  value={provisionForm.role}
                  onChange={e =>
                    setProvisionForm({ ...provisionForm, role: e.target.value as AdminRole })
                  }
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                >
                  <option value={AdminRole.SUPPORT_ADMIN}>
                    SUPPORT_ADMIN (Tickets & Read-Only)
                  </option>
                  <option value={AdminRole.NUTRITION_EDITOR}>
                    NUTRITION_EDITOR (Food Database & Recipes)
                  </option>
                  <option value={AdminRole.OPERATIONS_ADMIN}>
                    OPERATIONS_ADMIN (Users, Scans, Campaigns, Queues)
                  </option>
                  <option value={AdminRole.SUPER_ADMIN}>
                    SUPER_ADMIN (Full Clearance & Governance)
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProvisioning(false)}
                  className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionMutation.isPending}
                  className="px-4 py-1.5 rounded bg-white text-black font-medium text-xs disabled:opacity-50"
                >
                  {provisionMutation.isPending ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
