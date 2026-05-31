import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  IdCard,
  Loader2,
  MapPin,
  PlusCircle,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import PilotFormPanel from '../components/pilots/PilotFormPanel';
import { supabase } from '../lib/supabase';
import { ACTIVE_MISSION_STATUS } from '../lib/missionStatus';
import {
  formatDate,
  getDaysUntil,
  getPilotCertificationState,
  getPilotCurrencyState,
  getPilotReadiness,
  getPilotReadinessStyles,
  isPilotAssignable,
} from '../lib/pilotLifecycle';

const StatCard = ({ title, value, Icon, colorClass = 'text-text-primary' }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</span>
      <Icon size={18} className={colorClass} />
    </div>
    <div className={`mt-3 font-data text-3xl font-bold ${colorClass}`}>{value}</div>
  </div>
);

const getInitials = (name) => (
  name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'P'
);

const getCertTone = (state) => {
  if (state === 'expired') return 'text-status-danger';
  if (state === 'expiring' || state === 'missing') return 'text-status-warning';
  return 'text-status-success';
};

const getCurrencyLabel = (state) => {
  if (state === 'due') return 'Due';
  if (state === 'upcoming') return 'Upcoming';
  if (state === 'current') return 'Current';
  return 'Not set';
};

const PilotRegistryPage = () => {
  const navigate = useNavigate();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(null);
  const [pilots, setPilots] = useState([]);
  const [missions, setMissions] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchPilotBoard = async () => {
    setIsLoading(true);
    const [pilotResponse, missionResponse, logResponse] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'pilot')
        .order('created_at', { ascending: false }),
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, location, pilot_id')
        .in('status', ['Scheduled', ACTIVE_MISSION_STATUS])
        .order('date', { ascending: true }),
      supabase
        .from('flight_logs')
        .select('id, pilot_id, log_date, duration_minutes, incident_reported, mission:mission_id(name, mission_identifier)')
        .order('log_date', { ascending: false }),
    ]);

    if (pilotResponse.error) {
      console.error('Error fetching pilots:', pilotResponse.error);
      setPilots([]);
    } else {
      setPilots(pilotResponse.data || []);
    }

    if (!missionResponse.error) setMissions(missionResponse.data || []);
    if (!logResponse.error) setFlightLogs(logResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPilotBoard();
  }, []);

  const activeMissionByPilot = useMemo(() => {
    const map = new Map();
    missions.forEach((mission) => {
      if (mission.pilot_id && !map.has(mission.pilot_id)) map.set(mission.pilot_id, mission);
    });
    return map;
  }, [missions]);

  const latestLogByPilot = useMemo(() => {
    const map = new Map();
    flightLogs.forEach((log) => {
      if (log.pilot_id && !map.has(log.pilot_id)) map.set(log.pilot_id, log);
    });
    return map;
  }, [flightLogs]);

  const enrichedPilots = useMemo(() => (
    pilots.map((pilot) => {
      const activeMission = activeMissionByPilot.get(pilot.id);
      const readiness = getPilotReadiness(pilot, activeMission);

      return {
        ...pilot,
        activeMission,
        latestLog: latestLogByPilot.get(pilot.id),
        readiness,
        certificationState: getPilotCertificationState(pilot),
        currencyState: getPilotCurrencyState(pilot),
      };
    })
  ), [activeMissionByPilot, latestLogByPilot, pilots]);

  const stats = useMemo(() => ({
    total: enrichedPilots.length,
    ready: enrichedPilots.filter((pilot) => pilot.readiness === 'Ready' && isPilotAssignable(pilot, pilot.activeMission)).length,
    assigned: enrichedPilots.filter((pilot) => ['Assigned', 'In Mission'].includes(pilot.readiness)).length,
    renewal: enrichedPilots.filter((pilot) => pilot.readiness === 'Needs Renewal' || ['expired', 'expiring'].includes(pilot.certificationState)).length,
  }), [enrichedPilots]);

  const filteredPilots = useMemo(() => {
    const text = query.trim().toLowerCase();

    return enrichedPilots.filter((pilot) => {
      if (activeFilter !== 'all') {
        if (activeFilter === 'ready' && !(pilot.readiness === 'Ready' && isPilotAssignable(pilot, pilot.activeMission))) return false;
        if (activeFilter === 'assigned' && !['Assigned', 'In Mission'].includes(pilot.readiness)) return false;
        if (activeFilter === 'renewal' && !(pilot.readiness === 'Needs Renewal' || ['expired', 'expiring'].includes(pilot.certificationState))) return false;
        if (activeFilter === 'grounded' && !['Grounded', 'Inactive'].includes(pilot.readiness)) return false;
      }

      if (!text) return true;
      return [
        pilot.full_name,
        pilot.email,
        pilot.phone,
        pilot.licence_number,
        pilot.pilot_code,
        pilot.category,
        pilot.base_location,
      ].some((value) => (value || '').toLowerCase().includes(text));
    });
  }, [activeFilter, enrichedPilots, query]);

  const openNewPanel = () => {
    setSelectedPilot(null);
    setIsPanelOpen(true);
  };

  const openEditPanel = (pilot) => {
    setSelectedPilot(pilot);
    setIsPanelOpen(true);
  };

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-text-primary">Pilot Registry</h1>
          <p className="mt-1 text-sm text-text-muted">Manage pilot onboarding, currency, readiness, and assignments.</p>
        </div>
        <button
          onClick={openNewPanel}
          className="btn-primary inline-flex items-center justify-center gap-2 self-start px-4 py-2 text-sm uppercase tracking-wide xl:self-end"
        >
          <PlusCircle size={18} />
          Register New Pilot
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Pilots" value={stats.total} Icon={UserRound} />
        <StatCard title="Ready" value={stats.ready} Icon={CheckCircle2} colorClass="text-status-success" />
        <StatCard title="Assigned" value={stats.assigned} Icon={Clock} colorClass="text-accent" />
        <StatCard title="Renewal Risk" value={stats.renewal} Icon={ShieldAlert} colorClass="text-status-warning" />
      </div>

      <div className="card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, licence, code, phone, base..."
              className="input-field h-10 pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              ['all', 'All'],
              ['ready', 'Ready'],
              ['assigned', 'Assigned'],
              ['renewal', 'Renewal'],
              ['grounded', 'Grounded'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`shrink-0 rounded border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeFilter === id
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 flex-col items-center justify-center text-text-muted">
          <Loader2 className="mb-2 animate-spin" size={24} />
          Loading pilots...
        </div>
      ) : filteredPilots.length === 0 ? (
        <div className="card flex h-56 flex-col items-center justify-center text-center text-text-muted">
          <UserRound className="mb-3 opacity-50" size={34} />
          <p className="font-semibold text-text-secondary">No pilots match this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredPilots.map((pilot) => {
            const readinessClass = getPilotReadinessStyles(pilot.readiness);
            const licenceDays = getDaysUntil(pilot.licence_expiry);
            const medicalDays = getDaysUntil(pilot.medical_expiry);
            const certTone = getCertTone(pilot.certificationState);

            return (
              <article key={pilot.id} className="card min-w-0 overflow-hidden p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated font-heading font-bold text-text-primary">
                      {pilot.avatar_url ? (
                        <img src={pilot.avatar_url} alt={pilot.full_name} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(pilot.full_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-data text-xs uppercase tracking-wide text-text-muted">
                          {pilot.pilot_code || pilot.licence_number || 'No pilot code'}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${readinessClass}`}>
                          {pilot.readiness}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate font-heading text-xl font-bold uppercase tracking-wide text-text-primary">
                        {pilot.full_name || 'Unnamed Pilot'}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                        <MapPin size={14} />
                        {pilot.base_location || 'No base assigned'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={pilot.status || 'Unknown'} />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <IdCard size={14} />
                      Category
                    </div>
                    <div className="mt-2 font-data text-lg font-bold text-text-primary">{pilot.category || '-'}</div>
                  </div>
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <Clock size={14} />
                      Flight Hours
                    </div>
                    <div className="mt-2 font-data text-lg font-bold text-accent">{Number(pilot.total_flight_hours || 0).toFixed(1)} h</div>
                  </div>
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <Calendar size={14} />
                      Currency
                    </div>
                    <div className={`mt-2 text-sm font-semibold ${pilot.currencyState === 'due' ? 'text-status-danger' : pilot.currencyState === 'upcoming' ? 'text-status-warning' : 'text-text-primary'}`}>
                      {getCurrencyLabel(pilot.currencyState)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="rounded border border-border/70 bg-bg-elevated/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Certification</div>
                    <div className={`mt-1 font-semibold ${certTone}`}>
                      Licence {formatDate(pilot.licence_expiry)}
                    </div>
                    {licenceDays !== null && (
                      <div className="mt-1 text-xs text-text-muted">
                        {licenceDays < 0 ? `${Math.abs(licenceDays)} days overdue` : `${licenceDays} days remaining`}
                      </div>
                    )}
                    <div className={`mt-2 font-semibold ${certTone}`}>
                      Medical {formatDate(pilot.medical_expiry)}
                    </div>
                    {medicalDays !== null && (
                      <div className="mt-1 text-xs text-text-muted">
                        {medicalDays < 0 ? `${Math.abs(medicalDays)} days overdue` : `${medicalDays} days remaining`}
                      </div>
                    )}
                  </div>
                  <div className="rounded border border-border/70 bg-bg-elevated/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Assignment</div>
                    <div className="mt-1 text-text-primary">
                      {pilot.activeMission
                        ? `${pilot.activeMission.name || pilot.activeMission.mission_identifier} (${formatDate(pilot.activeMission.date)})`
                        : 'Available for scheduling'}
                    </div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Last Flight</div>
                    <div className="mt-1 text-text-secondary">
                      {pilot.latestLog
                        ? `${formatDate(pilot.latestLog.log_date)} - ${pilot.latestLog.duration_minutes || 0} min`
                        : 'No flight log yet'}
                    </div>
                  </div>
                </div>

                {pilot.readiness === 'Needs Renewal' && (
                  <div className="mt-4 flex items-start gap-3 rounded border border-status-warning/20 bg-status-warning/10 p-3 text-sm text-status-warning">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    Certification or currency must be renewed before this pilot is assigned again.
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                  <button
                    onClick={() => navigate(`/pilots/${pilot.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-accent/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
                  >
                    <Eye size={16} />
                    View Profile
                  </button>
                  <button
                    onClick={() => openEditPanel(pilot)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  >
                    <Edit size={16} />
                    Update Profile
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PilotFormPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedPilot(null);
        }}
        pilot={selectedPilot}
        onSave={fetchPilotBoard}
      />
    </div>
  );
};

export default PilotRegistryPage;
