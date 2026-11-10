import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AdminRole, hasRequiredAdminRole } from '@calmeter/shared';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  minimumRole?: AdminRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  minimumRole = AdminRole.SUPPORT_ADMIN,
}) => {
  const { admin, isLoading, isAuthenticated } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRequiredAdminRole(admin.role, minimumRole)) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-zinc-900 border border-zinc-800 p-4 mb-4">
          <svg
            className="h-8 w-8 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-2">Restricted Section</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
          Your current administrative role (
          <span className="text-zinc-200 font-mono">{admin.role}</span>) does not have sufficient
          clearance to access this operations console view.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
