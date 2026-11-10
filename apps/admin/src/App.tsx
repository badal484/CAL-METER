import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRole } from '@calmeter/shared';

// Views
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { UsersView } from './views/UsersView';
import { FoodDatabaseView } from './views/FoodDatabaseView';
import { RecipesView } from './views/RecipesView';
import { ScanOperationsView } from './views/ScanOperationsView';
import { AiManagementView } from './views/AiManagementView';
import { SubscriptionManagementView } from './views/SubscriptionManagementView';
import { NotificationCampaignsView } from './views/NotificationCampaignsView';
import { SupportTicketsView } from './views/SupportTicketsView';
import { SystemMonitoringView } from './views/SystemMonitoringView';
import { AdminManagementView } from './views/AdminManagementView';
import { AuditLogsView } from './views/AuditLogsView';
import { AdminSettingsView } from './views/AdminSettingsView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />

            <Route element={<AdminLayout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <DashboardView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <UsersView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/foods"
                element={
                  <ProtectedRoute minimumRole={AdminRole.NUTRITION_EDITOR}>
                    <FoodDatabaseView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recipes"
                element={
                  <ProtectedRoute minimumRole={AdminRole.NUTRITION_EDITOR}>
                    <RecipesView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scans"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <ScanOperationsView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai"
                element={
                  <ProtectedRoute minimumRole={AdminRole.OPERATIONS_ADMIN}>
                    <AiManagementView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <SubscriptionManagementView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute minimumRole={AdminRole.OPERATIONS_ADMIN}>
                    <NotificationCampaignsView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tickets"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <SupportTicketsView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system"
                element={
                  <ProtectedRoute minimumRole={AdminRole.OPERATIONS_ADMIN}>
                    <SystemMonitoringView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admins"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPER_ADMIN}>
                    <AdminManagementView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute minimumRole={AdminRole.OPERATIONS_ADMIN}>
                    <AuditLogsView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                    <AdminSettingsView />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
};
