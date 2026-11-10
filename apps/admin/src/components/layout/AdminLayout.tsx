import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  ChefHat,
  ScanLine,
  Sparkles,
  CreditCard,
  Bell,
  Headphones,
  Activity,
  ShieldAlert,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { AdminRole, hasRequiredAdminRole } from '@calmeter/shared';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: AdminRole;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Core Operations',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, minRole: AdminRole.SUPPORT_ADMIN },
      { name: 'User Directory', href: '/users', icon: Users, minRole: AdminRole.SUPPORT_ADMIN },
      {
        name: 'Support Tickets',
        href: '/tickets',
        icon: Headphones,
        minRole: AdminRole.SUPPORT_ADMIN,
      },
    ],
  },
  {
    title: 'Catalog & AI Engine',
    items: [
      {
        name: 'Food Database',
        href: '/foods',
        icon: UtensilsCrossed,
        minRole: AdminRole.NUTRITION_EDITOR,
      },
      {
        name: 'Recipe Catalog',
        href: '/recipes',
        icon: ChefHat,
        minRole: AdminRole.NUTRITION_EDITOR,
      },
      { name: 'Scan Operations', href: '/scans', icon: ScanLine, minRole: AdminRole.SUPPORT_ADMIN },
      { name: 'AI Telemetry', href: '/ai', icon: Sparkles, minRole: AdminRole.OPERATIONS_ADMIN },
    ],
  },
  {
    title: 'Monetization & Outreach',
    items: [
      {
        name: 'Subscriptions',
        href: '/subscriptions',
        icon: CreditCard,
        minRole: AdminRole.SUPPORT_ADMIN,
      },
      {
        name: 'Push Campaigns',
        href: '/campaigns',
        icon: Bell,
        minRole: AdminRole.OPERATIONS_ADMIN,
      },
    ],
  },
  {
    title: 'Infrastructure & Security',
    items: [
      {
        name: 'System Monitoring',
        href: '/system',
        icon: Activity,
        minRole: AdminRole.OPERATIONS_ADMIN,
      },
      { name: 'Admin Team', href: '/admins', icon: ShieldAlert, minRole: AdminRole.SUPER_ADMIN },
      {
        name: 'Audit Logs',
        href: '/audit-logs',
        icon: FileText,
        minRole: AdminRole.OPERATIONS_ADMIN,
      },
      { name: 'Settings', href: '/settings', icon: Settings, minRole: AdminRole.SUPPORT_ADMIN },
    ],
  },
];

export const AdminLayout: React.FC = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role: AdminRole) => {
    switch (role) {
      case AdminRole.SUPER_ADMIN:
        return 'bg-white text-black font-semibold';
      case AdminRole.OPERATIONS_ADMIN:
        return 'bg-zinc-800 text-zinc-200 border border-zinc-700';
      case AdminRole.NUTRITION_EDITOR:
        return 'bg-zinc-800 text-zinc-300 border border-zinc-700';
      case AdminRole.SUPPORT_ADMIN:
      default:
        return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div>
          {/* Logo Brand */}
          <div className="h-16 flex items-center px-6 border-b border-zinc-800/80 gap-3">
            <div className="h-7 w-7 rounded bg-white flex items-center justify-center text-black font-black text-xs tracking-wider">
              CM
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white">CAL METER</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                Ops Console
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navSections.map(section => {
              const visibleItems = section.items.filter(item =>
                admin ? hasRequiredAdminRole(admin.role, item.minRole) : false,
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className="space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    {section.title}
                  </div>
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.href === '/'}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-zinc-800 text-white font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate pr-2">
              <div className="text-xs font-medium text-white truncate">{admin?.name}</div>
              <div className="text-[11px] text-zinc-500 truncate">{admin?.email}</div>
            </div>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono ${
                admin ? getRoleBadgeColor(admin.role) : ''
              }`}
            >
              {admin?.role.replace('_ADMIN', '')}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Operations</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-white font-medium capitalize">
              {location.pathname === '/'
                ? 'Dashboard'
                : location.pathname.slice(1).replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-400 font-mono text-[11px]">System Online</span>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-black">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
