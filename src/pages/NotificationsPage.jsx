import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle,
  ClipboardList,
  Inbox,
  Info,
  Plane,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'missions', label: 'Missions' },
  { id: 'flight_logs', label: 'Flight Logs' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'system', label: 'System' },
];

const priorityStyles = {
  critical: 'bg-status-danger/10 text-status-danger border-status-danger/20',
  action: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  normal: 'bg-accent/10 text-accent border-accent/20',
  low: 'bg-bg-elevated text-text-muted border-border',
};

const iconStyles = {
  critical: 'bg-status-danger/10 text-status-danger border-status-danger/20',
  action: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  normal: 'bg-accent/10 text-accent border-accent/20',
  low: 'bg-bg-elevated text-text-muted border-border',
};

const storedTypeMeta = {
  incident_reported: {
    category: 'incidents',
    categoryLabel: 'Incident',
    priority: 'critical',
    Icon: AlertTriangle,
    actionLabel: 'Review Incident',
  },
  flight_log_submitted: {
    category: 'flight_logs',
    categoryLabel: 'Flight Log',
    priority: 'action',
    Icon: ClipboardList,
    actionLabel: 'Review Log',
  },
  flight_log_approved: {
    category: 'flight_logs',
    categoryLabel: 'Flight Log',
    priority: 'normal',
    Icon: ClipboardList,
    actionLabel: 'View Log',
  },
  flight_log_declined: {
    category: 'flight_logs',
    categoryLabel: 'Flight Log',
    priority: 'critical',
    Icon: ClipboardList,
    actionLabel: 'Review Log',
  },
  mission_assigned: {
    category: 'missions',
    categoryLabel: 'Mission',
    priority: 'action',
    Icon: Plane,
    actionLabel: 'Open Mission',
  },
  mission_started: {
    category: 'missions',
    categoryLabel: 'Mission',
    priority: 'normal',
    Icon: Plane,
    actionLabel: 'Open Mission',
  },
  mission_completed: {
    category: 'missions',
    categoryLabel: 'Mission',
    priority: 'normal',
    Icon: Plane,
    actionLabel: 'Open Mission',
  },
  mission_update: {
    category: 'missions',
    categoryLabel: 'Mission',
    priority: 'normal',
    Icon: Plane,
    actionLabel: 'Open Mission',
  },
  system: {
    category: 'system',
    categoryLabel: 'System',
    priority: 'low',
    Icon: Info,
    actionLabel: 'Acknowledge',
  },
};

const normalizeText = (value) => (value || '').toLowerCase();
const normalizePriority = (value) => (
  ['low', 'normal', 'action', 'critical'].includes(value) ? value : null
);

const classifyNotification = (notification) => {
  const storedMeta = storedTypeMeta[notification.type];
  const priority = normalizePriority(notification.priority);

  if (storedMeta) {
    return {
      ...storedMeta,
      priority: priority || storedMeta.priority,
    };
  }

  const title = normalizeText(notification.title);
  const content = normalizeText(notification.content);
  const text = `${title} ${content}`;

  if (text.includes('incident')) {
    return {
      category: 'incidents',
      categoryLabel: 'Incident',
      priority: priority || 'critical',
      Icon: AlertTriangle,
      actionLabel: notification.mission_id ? 'Review Incident' : 'Review Alert',
    };
  }

  if (text.includes('flight log') || text.includes('log submitted') || text.includes('approved') || text.includes('declined')) {
    const isDeclined = text.includes('declined');
    const isApproved = text.includes('approved');
    return {
      category: 'flight_logs',
      categoryLabel: 'Flight Log',
      priority: priority || (isDeclined ? 'critical' : isApproved ? 'normal' : 'action'),
      Icon: ClipboardList,
      actionLabel: isApproved ? 'View Log' : isDeclined ? 'Review Log' : 'Review Log',
    };
  }

  if (text.includes('mission')) {
    return {
      category: 'missions',
      categoryLabel: 'Mission',
      priority: priority || (text.includes('cancelled') ? 'critical' : text.includes('assigned') ? 'action' : 'normal'),
      Icon: Plane,
      actionLabel: notification.mission_id ? 'Open Mission' : 'View Missions',
    };
  }

  if (text.includes('licence') || text.includes('license') || text.includes('certificate') || text.includes('maintenance')) {
    return {
      category: 'system',
      categoryLabel: 'System',
      priority: priority || 'action',
      Icon: ShieldCheck,
      actionLabel: 'Review',
    };
  }

  return {
    category: 'system',
    categoryLabel: 'System',
    priority: priority || 'low',
    Icon: Info,
    actionLabel: notification.mission_id ? 'Open' : 'Acknowledge',
  };
};

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotificationsPage = () => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, content, unread, read_at, created_at, mission_id, flight_log_id, drone_id, type, priority, actor_id')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-notifs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new, ...(prev || [])]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => (prev || []).map(n => n.id === payload.new.id ? payload.new : n));
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [user?.id]);

  const enrichedNotifications = useMemo(() => (
    notifications.map((notification) => ({
      ...notification,
      meta: classifyNotification(notification),
    }))
  ), [notifications]);

  const counts = useMemo(() => {
    const unread = enrichedNotifications.filter((notification) => notification.unread).length;
    const awaitingReview = enrichedNotifications.filter((notification) => (
      notification.meta.category === 'flight_logs' &&
      notification.meta.priority === 'action' &&
      notification.unread
    )).length;
    const incidents = enrichedNotifications.filter((notification) => notification.meta.category === 'incidents').length;
    const missionUpdates = enrichedNotifications.filter((notification) => notification.meta.category === 'missions').length;

    return { unread, awaitingReview, incidents, missionUpdates };
  }, [enrichedNotifications]);

  const filteredNotifications = useMemo(() => (
    enrichedNotifications.filter((notification) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'unread') return notification.unread;
      return notification.meta.category === activeTab;
    })
  ), [activeTab, enrichedNotifications]);

  const markAllRead = async () => {
    if (!user?.id) return;
    try {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('notifications')
        .update({ unread: false, read_at: readAt })
        .eq('recipient_id', user.id)
        .eq('unread', true);
      if (error) throw error;
      setNotifications((prev) => prev.map((notification) => ({ ...notification, unread: false, read_at: readAt })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const markRead = async (id) => {
    try {
      const readAt = new Date().toISOString();
      const { error } = await supabase.from('notifications').update({ unread: false, read_at: readAt }).eq('id', id);
      if (error) throw error;
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, unread: false, read_at: readAt } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const resolveFlightLogRoute = async (missionId) => {
    if (!missionId) return '/flight-logs';

    const { data, error } = await supabase
      .from('flight_logs')
      .select('id')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) return `/missions/${missionId}`;
    return `/flight-logs/${data.id}`;
  };

  const openNotification = async (notification) => {
    await markRead(notification.id);

    if (notification.meta.category === 'flight_logs' || notification.meta.category === 'incidents') {
      if (notification.flight_log_id) {
        navigate(`/flight-logs/${notification.flight_log_id}`);
        return;
      }
      navigate(await resolveFlightLogRoute(notification.mission_id));
      return;
    }

    if (notification.mission_id) {
      navigate(`/missions/${notification.mission_id}`);
      return;
    }

    if (notification.meta.category === 'flight_logs') navigate('/flight-logs');
    else if (notification.meta.category === 'missions') navigate('/missions');
  };

  return (
    <div className="space-y-4 md:space-y-6 min-w-0 pb-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Operations Inbox</h1>
          <p className="font-sans text-sm text-text-muted mt-1">
            Actionable mission, flight-log, incident, and system updates.
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={counts.unread === 0}
          className="bg-transparent border border-border hover:border-accent text-text-primary font-sans text-xs font-semibold uppercase py-2 px-4 rounded transition-colors flex items-center gap-2 self-start lg:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCheck size={18} />
          <span>Mark all read</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        <div className="card p-3 md:p-4 border-l-4 border-l-accent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Unread</span>
            <Bell size={18} className="text-accent" />
          </div>
          <div className="font-data text-2xl md:text-3xl font-bold text-text-primary mt-3">{counts.unread}</div>
          <div className="text-text-muted text-[11px] md:text-xs font-medium mt-2">Requires attention</div>
        </div>
        <div className="card p-3 md:p-4 border-l-4 border-l-status-warning">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Review Queue</span>
            <ClipboardList size={18} className="text-status-warning" />
          </div>
          <div className="font-data text-2xl md:text-3xl font-bold text-status-warning mt-3">{counts.awaitingReview}</div>
          <div className="text-text-muted text-[11px] md:text-xs font-medium mt-2">Unread log actions</div>
        </div>
        <div className="card p-3 md:p-4 border-l-4 border-l-status-danger">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Incidents</span>
            <AlertTriangle size={18} className="text-status-danger" />
          </div>
          <div className="font-data text-2xl md:text-3xl font-bold text-status-danger mt-3">{counts.incidents}</div>
          <div className="text-text-muted text-[11px] md:text-xs font-medium mt-2">Operational alerts</div>
        </div>
        <div className="card p-3 md:p-4 border-l-4 border-l-status-success">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mission Updates</span>
            <Plane size={18} className="text-status-success" />
          </div>
          <div className="font-data text-2xl md:text-3xl font-bold text-status-success mt-3">{counts.missionUpdates}</div>
          <div className="text-text-muted text-[11px] md:text-xs font-medium mt-2">Assignment and progress</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border overflow-x-auto">
          <div className="flex min-w-max p-2 gap-1">
            {tabs.map((tab) => {
              const tabCount = tab.id === 'all'
                ? enrichedNotifications.length
                : tab.id === 'unread'
                  ? counts.unread
                  : enrichedNotifications.filter((notification) => notification.meta.category === tab.id).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
                    activeTab === tab.id
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-transparent'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 font-data">{tabCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center text-text-muted py-16">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-bg-elevated p-5 rounded border border-border text-text-muted shadow-inner">
              {enrichedNotifications.length === 0 ? <Rocket size={36} /> : <Inbox size={36} />}
            </div>
            <h3 className="font-heading text-xl text-text-primary uppercase mt-4 mb-2">
              {enrichedNotifications.length === 0 ? 'All Clear' : 'Nothing In This Queue'}
            </h3>
            <p className="font-sans text-sm text-text-muted max-w-md">
              {enrichedNotifications.length === 0
                ? 'No notifications yet. New mission and flight-log events will appear here.'
                : 'Try another queue or mark incoming actions as they arrive.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredNotifications.map((notification) => {
              const { Icon } = notification.meta;
              const priorityClass = priorityStyles[notification.meta.priority] || priorityStyles.low;
              const iconClass = iconStyles[notification.meta.priority] || iconStyles.low;

              return (
                <article
                  key={notification.id}
              className={`relative p-3 md:p-5 transition-colors hover:bg-bg-elevated/20 ${notification.unread ? '' : 'opacity-75'}`}
                >
                  {notification.unread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className={`shrink-0 p-2 rounded border self-start ${iconClass}`}>
                      <Icon size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityClass}`}>
                          {notification.meta.priority}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          {notification.meta.categoryLabel}
                        </span>
                        {notification.unread && (
                          <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                            New
                          </span>
                        )}
                        <span className="font-data text-xs text-text-muted ml-auto">{formatTime(notification.created_at)}</span>
                      </div>

                      <h2 className="font-sans text-sm text-text-primary font-semibold break-words">
                        {notification.title || 'System notification'}
                      </h2>
                      <p className="font-sans text-sm text-text-secondary leading-relaxed mt-1 break-words">
                        {notification.content || 'No details provided.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:items-stretch shrink-0">
                      <button
                        onClick={() => openNotification(notification)}
                        className="rounded border border-accent/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-accent hover:bg-accent/10 transition-colors"
                      >
                        {notification.meta.actionLabel}
                      </button>
                      {notification.unread ? (
                        <button
                          onClick={() => markRead(notification.id)}
                          className="rounded border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1 rounded border border-status-success/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-status-success">
                          <CheckCircle size={13} />
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
