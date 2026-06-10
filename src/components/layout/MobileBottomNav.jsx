import { useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  MoreHorizontal,
  Plane,
  Send,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const allItems = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard, roles: ['administrator', 'manager', 'pilot'], primary: true },
  { name: 'Missions', path: '/missions', icon: Plane, roles: ['administrator', 'manager', 'pilot'], primary: true },
  { name: 'Logs', path: '/flight-logs', icon: ClipboardList, roles: ['administrator', 'manager', 'pilot'], primary: true },
  { name: 'Pilots', path: '/pilots', icon: Users, roles: ['administrator', 'manager'], primary: true },
  { name: 'Drones', path: '/drones', icon: Send, roles: ['administrator', 'manager'], primary: true },
  { name: 'Alerts', path: '/notifications', icon: Bell, roles: ['administrator', 'manager', 'pilot'], primary: true, badge: true },
  { name: 'Reports', path: '/reports', icon: FileBarChart, roles: ['administrator', 'manager'], primary: false },
  { name: 'Users', path: '/users', icon: Settings, roles: ['administrator'], primary: false },
];

const MobileBottomNav = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('unread', true);

      if (!error) setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel(`mobile-nav-unread-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, fetchUnread)
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [user?.id]);

  const { primaryItems, moreItems } = useMemo(() => {
    const roleItems = allItems.filter((item) => item.roles.includes(user?.role));
    const preferredPrimary = user?.role === 'pilot'
      ? ['/dashboard', '/missions', '/flight-logs', '/notifications']
      : ['/dashboard', '/missions', '/pilots', '/drones', '/notifications'];

    return {
      primaryItems: roleItems.filter((item) => preferredPrimary.includes(item.path)).slice(0, 5),
      moreItems: roleItems.filter((item) => !preferredPrimary.includes(item.path)),
    };
  }, [user?.role]);

  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.path));

  return (
    <div className="md:hidden">
      {isMoreOpen && moreItems.length > 0 && (
        <div className="fixed inset-x-3 bottom-[78px] z-40 rounded border border-border bg-bg-surface p-2 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMoreOpen(false)}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-2 rounded border px-3 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border bg-bg-primary text-text-secondary hover:text-text-primary'
                  )}
                >
                  <Icon size={18} />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}

            <button
              onClick={() => {
                setIsMoreOpen(false);
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 rounded border border-border bg-bg-primary px-3 py-3 text-sm font-semibold text-text-secondary hover:text-status-danger transition-colors text-left"
            >
              <LogOut size={18} />
              <span className="truncate">Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {isMoreOpen && moreItems.length > 0 && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-bg-primary/20"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur">
        <div className={clsx('grid gap-1', moreItems.length > 0 ? 'grid-cols-6' : primaryItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5')}>
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMoreOpen(false)}
                className={({ isActive }) => clsx(
                  'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded px-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                <Icon size={20} />
                <span className="max-w-full truncate">{item.name}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="absolute right-3 top-1 min-w-4 rounded-full bg-status-danger px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}

          {moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen((value) => !value)}
              className={clsx(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded px-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                isMoreOpen || isMoreActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              <MoreHorizontal size={20} />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default MobileBottomNav;
