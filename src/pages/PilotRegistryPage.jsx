import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  Loader2,
  PlusCircle,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import PaginationControls from '../components/ui/PaginationControls';
import PilotFormPanel from '../components/pilots/PilotFormPanel';
import { supabase } from '../lib/supabase';
import { ACTIVE_MISSION_STATUS } from '../lib/missionStatus';
import {
  formatDate,
  getPilotCertificationState,
  getPilotCurrencyState,
  getPilotReadiness,
  getPilotReadinessStyles,
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

const PAGE_SIZE_DEFAULT = 25;

const applyPilotSearch = (request, text) => {
  const value = text.trim().replace(/,/g, ' ');
  if (!value) return request;

  return request.or([
    `full_name.ilike.%${value}%`,
    `email.ilike.%${value}%`,
    `phone.ilike.%${value}%`,
    `licence_number.ilike.%${value}%`,
    `pilot_code.ilike.%${value}%`,
    `category.ilike.%${value}%`,
    `base_location.ilike.%${value}%`,
  ].join(','));
};

const applyPilotFilter = (request, filter) => {
  if (filter === 'ready') return request.eq('status', 'Active').eq('readiness_status', 'Ready');
  if (filter === 'assigned') return request.in('readiness_status', ['Assigned', 'In Mission']);
  if (filter === 'renewal') return request.eq('readiness_status', 'Needs Renewal');
  if (filter === 'grounded') return request.or('readiness_status.in.(Grounded,Inactive),status.in.(Suspended,Inactive)');
  return request;
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, ready: 0, assigned: 0, renewal: 0 });

  const fetchPilotBoard = async () => {
    setIsLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let pilotRequest = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'pilot')
        .order('created_at', { ascending: false })
        .range(from, to);

    pilotRequest = applyPilotFilter(applyPilotSearch(pilotRequest, query), activeFilter);

    const [pilotResponse, totalResponse, readyResponse, assignedResponse, renewalResponse] = await Promise.all([
      pilotRequest,
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pilot'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pilot').eq('status', 'Active').eq('readiness_status', 'Ready'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pilot').in('readiness_status', ['Assigned', 'In Mission']),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pilot').eq('readiness_status', 'Needs Renewal'),
    ]);

    if (pilotResponse.error) {
      console.error('Error fetching pilots:', pilotResponse.error);
      setPilots([]);
    } else {
      setPilots(pilotResponse.data || []);
      setTotalCount(pilotResponse.count || 0);
    }

    setStats({
      total: totalResponse.count || 0,
      ready: readyResponse.count || 0,
      assigned: assignedResponse.count || 0,
      renewal: renewalResponse.count || 0,
    });

    const pilotIds = (pilotResponse.data || []).map((pilot) => pilot.id);
    if (pilotIds.length === 0) {
      setMissions([]);
      setFlightLogs([]);
      setIsLoading(false);
      return;
    }

    const [missionResponse, logResponse] = await Promise.all([
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, location, pilot_id')
        .in('pilot_id', pilotIds)
        .in('status', ['Scheduled', ACTIVE_MISSION_STATUS])
        .order('date', { ascending: true }),
      supabase
        .from('flight_logs')
        .select('id, pilot_id, log_date, duration_minutes, incident_reported, mission:mission_id(name, mission_identifier)')
        .in('pilot_id', pilotIds)
        .order('log_date', { ascending: false }),
    ]);

    if (!missionResponse.error) setMissions(missionResponse.data || []);
    if (!logResponse.error) setFlightLogs(logResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPilotBoard();
  }, [activeFilter, page, pageSize, query]);

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
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
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
                onClick={() => {
                  setActiveFilter(id);
                  setPage(1);
                }}
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
      ) : enrichedPilots.length === 0 ? (
        <div className="card flex h-56 flex-col items-center justify-center text-center text-text-muted">
          <UserRound className="mb-3 opacity-50" size={34} />
          <p className="font-semibold text-text-secondary">No pilots match this view.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-left text-sm">
              <thead className="border-b border-border bg-bg-elevated/50 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="w-[20%] px-4 py-3 font-semibold">Pilot</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Status</th>
                  <th className="w-[12%] px-4 py-3 font-semibold">Readiness</th>
                  <th className="w-[11%] px-4 py-3 font-semibold">Base</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Category</th>
                  <th className="w-[8%] px-4 py-3 font-semibold">Hours</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Licence</th>
                  <th className="w-[9%] px-4 py-3 font-semibold">Assignment</th>
                  <th className="w-[10%] px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {enrichedPilots.map((pilot, index) => {
                  const readinessClass = getPilotReadinessStyles(pilot.readiness);
                  const assignment = pilot.activeMission
                    ? `${pilot.activeMission.name || pilot.activeMission.mission_identifier} (${formatDate(pilot.activeMission.date)})`
                    : 'Available';

                  return (
                    <tr key={pilot.id} className={`transition-colors hover:bg-bg-elevated/40 ${index % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated font-heading text-xs font-bold text-text-primary">
                            {pilot.avatar_url ? (
                              <img src={pilot.avatar_url} alt={pilot.full_name} className="h-full w-full object-cover" />
                            ) : (
                              getInitials(pilot.full_name)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-text-primary">{pilot.full_name || 'Unnamed Pilot'}</div>
                            <div className="truncate font-data text-xs text-text-muted">{pilot.pilot_code || pilot.licence_number || 'No pilot code'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={pilot.status || 'Unknown'} /></td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${readinessClass}`}>
                          {pilot.readiness}
                        </span>
                      </td>
                      <td className="truncate px-4 py-4 text-text-secondary">{pilot.base_location || '-'}</td>
                      <td className="truncate px-4 py-4 font-data text-text-secondary">{pilot.category || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-data text-accent">{Number(pilot.total_flight_hours || 0).toFixed(1)} h</td>
                      <td className="px-4 py-4">
                        <div className="font-data text-text-secondary">{formatDate(pilot.licence_expiry)}</div>
                        <div className={`mt-1 text-xs ${pilot.certificationState === 'expired' ? 'text-status-danger' : pilot.certificationState === 'expiring' ? 'text-status-warning' : 'text-text-muted'}`}>
                          {pilot.certificationState}
                        </div>
                      </td>
                      <td className="truncate px-4 py-4 text-text-secondary">{assignment}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/pilots/${pilot.id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-accent/30 text-accent transition-colors hover:bg-accent/10"
                            title="View profile"
                            aria-label={`View ${pilot.full_name || 'pilot'} profile`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => openEditPanel(pilot)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                            title="Edit profile"
                            aria-label={`Edit ${pilot.full_name || 'pilot'} profile`}
                          >
                            <Edit size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="pilots"
        />
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
