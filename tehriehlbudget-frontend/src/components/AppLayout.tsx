import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tags },
];

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycle}
      aria-label={`Toggle theme (current: ${theme})`}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="text-base font-bold">TehRiehlBudget</h1>
        <ThemeToggle />
      </header>

      {/* Backdrop (mobile only) */}
      <div
        data-drawer-backdrop
        onClick={() => setDrawerOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Sidebar (drawer on mobile, fixed on desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between p-4 md:h-auto md:p-6">
          <h1 className="text-lg font-bold">TehRiehlBudget</h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="md:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-4">
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
        </nav>
        <Separator />
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
