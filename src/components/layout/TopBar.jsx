import { useContext, useEffect, useState, useRef } from 'react';
import { Bell, Search, User, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathName = location.pathname.split('/')[1] || 'dashboard';
  const pageTitle = pathName.charAt(0).toUpperCase() + pathName.slice(1).replace('-', ' ');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('unread', true);

        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('Failed to fetch top-bar notification count:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel(`topbar-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [user?.id]);

  return (
    <header className="h-14 md:h-16 border-b border-border glassmorphism sticky top-0 z-10 flex items-center justify-between px-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent font-heading text-xs font-bold tracking-wide text-white md:hidden">
          DSZ
        </div>
        <h1 className="truncate text-lg font-heading font-semibold text-text-primary tracking-wide md:text-xl">
          {pageTitle}
        </h1>
        <div className="hidden md:flex items-center text-sm text-text-muted">
          <span>Home</span>
          <span className="mx-2">&gt;</span>
          <span className="text-text-primary">{pageTitle}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-6">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search pilots, missions..."
            className="input-field pl-9 w-64 h-9 text-sm rounded-full"
          />
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open notifications"
          title="Open notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 bg-status-danger text-white text-[10px] font-bold rounded-full border border-bg-primary flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="relative hidden sm:block" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center hover:bg-bg-surface transition-colors"
          >
            <User size={16} className="text-text-secondary" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-bg-surface border border-border rounded shadow-lg z-50">
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-status-danger hover:bg-bg-elevated transition-colors text-left"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
