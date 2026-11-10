import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminRole } from '@calmeter/shared';
import { AdminAuthProvider, useAdminAuth } from '../context/AdminAuthContext';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { LoginView } from '../views/LoginView';
import { adminClient } from '../api/adminClient';

describe('Web Admin Panel Frontend Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders login view with bearer token input and developer test buttons', () => {
    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <LoginView />
        </MemoryRouter>
      </AdminAuthProvider>,
    );

    expect(screen.getByText('CAL METER')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Paste Firebase Admin ID Bearer Token/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Ops Admin')).toBeInTheDocument();
  });

  it('redirects unauthenticated user from protected route to /login', async () => {
    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute minimumRole={AdminRole.SUPPORT_ADMIN}>
                  <div>Protected Dashboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page Target</div>} />
          </Routes>
        </MemoryRouter>
      </AdminAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Target')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });

  it('blocks access when admin role has insufficient privileges', async () => {
    // Mock getMe returning SUPPORT_ADMIN
    vi.spyOn(adminClient, 'getMe').mockResolvedValue({
      id: 'support-admin-uuid',
      email: 'support@calmeter.test',
      name: 'Support Agent',
      role: AdminRole.SUPPORT_ADMIN,
      isActive: true,
    });

    localStorage.setItem('calmeter_admin_token', 'test-token');

    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/governance']}>
          <Routes>
            <Route
              path="/governance"
              element={
                <ProtectedRoute minimumRole={AdminRole.SUPER_ADMIN}>
                  <div>Super Admin Governance Zone</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AdminAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Restricted Section')).toBeInTheDocument();
    });
    expect(screen.getByText(/SUPPORT_ADMIN/)).toBeInTheDocument();
    expect(screen.queryByText('Super Admin Governance Zone')).not.toBeInTheDocument();
  });

  it('permits authorized admin to view cleared component', async () => {
    vi.spyOn(adminClient, 'getMe').mockResolvedValue({
      id: 'super-admin-uuid',
      email: 'super@calmeter.test',
      name: 'Super Admin Operator',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    });

    localStorage.setItem('calmeter_admin_token', 'super-token');

    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/governance']}>
          <Routes>
            <Route
              path="/governance"
              element={
                <ProtectedRoute minimumRole={AdminRole.SUPER_ADMIN}>
                  <div>Super Admin Governance Zone Active</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AdminAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Super Admin Governance Zone Active')).toBeInTheDocument();
    });
  });

  it('manages token in localStorage and clears upon logout', async () => {
    vi.spyOn(adminClient, 'getMe').mockResolvedValue({
      id: 'admin-uuid',
      email: 'admin@calmeter.test',
      name: 'Test Admin',
      role: AdminRole.OPERATIONS_ADMIN,
      isActive: true,
    });

    const TestConsumer: React.FC = () => {
      const { admin, login, logout, isAuthenticated } = useAdminAuth();
      return (
        <div>
          <div>Auth: {isAuthenticated ? 'YES' : 'NO'}</div>
          <div>Admin: {admin?.name || 'NONE'}</div>
          <button onClick={() => login('mock-jwt-token')}>Do Login</button>
          <button onClick={() => logout()}>Do Logout</button>
        </div>
      );
    };

    render(
      <AdminAuthProvider>
        <TestConsumer />
      </AdminAuthProvider>,
    );

    expect(screen.getByText('Auth: NO')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Do Login'));

    await waitFor(() => {
      expect(screen.getByText('Auth: YES')).toBeInTheDocument();
    });
    expect(screen.getByText('Admin: Test Admin')).toBeInTheDocument();
    expect(localStorage.getItem('calmeter_admin_token')).toBe('mock-jwt-token');

    fireEvent.click(screen.getByText('Do Logout'));

    expect(screen.getByText('Auth: NO')).toBeInTheDocument();
    expect(localStorage.getItem('calmeter_admin_token')).toBeNull();
  });
});
