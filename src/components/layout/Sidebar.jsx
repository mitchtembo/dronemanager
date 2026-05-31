import { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { LayoutDashboard, Users, Plane, ClipboardList, Send, FileBarChart, Bell, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';

const Sidebar = ({ isCollapsed = false, onToggle }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('unread', true);
        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };

    fetchCount();

    const channel = supabase
      .channel(`user-unread-count-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
        // Recalculate count on any change
        fetchCount();
      })
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  }, [user?.id]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['administrator', 'manager', 'pilot'] },
    { name: 'Pilot Registry', path: '/pilots', icon: Users, roles: ['administrator', 'manager'] },
    { name: 'Missions', path: '/missions', icon: Plane, roles: ['administrator', 'manager', 'pilot'] },
    { name: 'Flight Logs', path: '/flight-logs', icon: ClipboardList, roles: ['administrator', 'manager', 'pilot'] },
    { name: 'Drones', path: '/drones', icon: Send, roles: ['administrator', 'manager'] },
    { name: 'Reports', path: '/reports', icon: FileBarChart, roles: ['administrator', 'manager'] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: ['administrator', 'manager', 'pilot'], badge: unreadCount },
    { name: 'User Management', path: '/users', icon: Settings, roles: ['administrator'] },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={clsx(
      "fixed left-0 top-0 hidden h-screen bg-bg-surface border-r border-border flex-col z-20 transition-[width] duration-300 md:flex",
      isCollapsed ? "w-[76px]" : "w-[240px]"
    )}>
      <div className={clsx(
        "flex items-center h-16 border-b border-border",
        isCollapsed ? "justify-center gap-2 px-2" : "justify-between gap-3 px-6"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded bg-accent flex items-center justify-center font-heading font-bold text-white tracking-wider">DSZ</div>
          {!isCollapsed && (
            <span className="font-heading font-bold text-lg tracking-wider text-text-primary truncate">DPMS</span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="shrink-0 p-2 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={clsx(
        "flex-1 overflow-y-auto no-scrollbar py-4 space-y-1",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {navItems.filter(item => item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              aria-label={item.name}
              className={({ isActive }) => clsx(
                "relative flex items-center rounded transition-all font-sans text-sm font-medium",
                isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5",
                isActive
                  ? clsx("bg-bg-elevated text-accent border-l-4 border-accent", isCollapsed ? "pl-0" : "pl-2")
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}
              {!isCollapsed && item.badge > 0 && (
                <span className="bg-status-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {isCollapsed && item.badge > 0 && (
                <span className="absolute right-2 top-2 w-2 h-2 bg-status-danger rounded-full border border-bg-surface" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className={clsx("border-t border-border", isCollapsed ? "p-3" : "p-4")}>
        <div className={clsx(
          "flex items-center mb-4",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <div
            title={isCollapsed ? `${user?.fullName || 'User'} (${user?.role || 'role'})` : undefined}
            className="w-10 h-10 shrink-0 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-primary font-bold"
          >
            {user?.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
          </div>
          {!isCollapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-text-primary truncate">{user?.fullName}</p>
            <p className="text-xs text-text-muted font-sans uppercase tracking-wider">{user?.role}</p>
          </div>
          )}
        </div>
        <button 
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          aria-label="Sign Out"
          className={clsx(
            "w-full flex items-center justify-center py-2 text-sm text-text-secondary hover:text-status-danger transition-colors rounded hover:bg-bg-elevated",
            isCollapsed ? "gap-0" : "gap-2"
          )}
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
