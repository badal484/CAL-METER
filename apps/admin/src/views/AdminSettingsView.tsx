import React from 'react';
import { ShieldCheck, User, Check, Lock, FileCheck } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ROLE_CAPABILITIES } from '@calmeter/shared';

export const AdminSettingsView: React.FC = () => {
  const { admin } = useAdminAuth();

  if (!admin) return null;

  const currentCapabilities = ROLE_CAPABILITIES[admin.role] || [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Administrator Profile & Security Governance
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          View your administrative clearance levels, verify active security controls, and inspect
          access capabilities.
        </p>
      </div>

      {/* Operator Identity Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
          <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
            <User className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{admin.name}</h2>
            <p className="text-xs text-zinc-400 font-mono">{admin.email}</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded text-xs font-semibold bg-white text-black font-mono">
            {admin.role}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500">Administrator ID:</span>
            <div className="text-zinc-300 truncate mt-0.5">{admin.id}</div>
          </div>
          <div>
            <span className="text-zinc-500">Security Clearance:</span>
            <div className="text-emerald-400 mt-0.5 font-sans">Authorized & Active</div>
          </div>
        </div>
      </div>

      {/* Role Capabilities Matrix */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Granted Operational Capabilities</h3>
          </div>
          <span className="text-xs text-zinc-400">
            {currentCapabilities.length} capabilities assigned
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {currentCapabilities.map(cap => (
            <div
              key={cap}
              className="flex items-center gap-2.5 p-2 rounded bg-zinc-900/50 border border-zinc-850"
            >
              <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono text-zinc-300">{cap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security Governance Checklist */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-850 pb-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">
            CAL METER Operational Security Policies
          </h3>
        </div>

        <div className="space-y-3 text-xs text-zinc-300">
          <div className="flex items-start gap-3">
            <FileCheck className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Immutable Append-Only Audit Logging</div>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Every state-changing operation (user suspension, food modification, admin
                provisioning) is written to a non-updatable PostgreSQL audit log with remote IP and
                timestamp.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileCheck className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Server-Side RBAC Enforcement</div>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Frontend UI controls are for operator convenience. Every single API route validates
                the admin bearer token and enforces role rank boundaries before database execution.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileCheck className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">No Public Admin Registration</div>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Administrator accounts cannot be registered via mobile or web sign-up flows. They
                must be explicitly provisioned by an active SUPER_ADMIN.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
