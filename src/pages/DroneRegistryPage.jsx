import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  PlaneTakeoff,
  PlusCircle,
  Search,
  Wrench,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import PaginationControls from '../components/ui/PaginationControls';
import DroneFormModal from '../components/drones/DroneFormModal';
import { supabase } from '../lib/supabase';
import {
  formatDate,
  getDroneReadiness,
  getHoursSinceService,
  getReadinessStyles,
  getServiceProgress,
  isMaintenanceDue,
} from '../lib/droneLifecycle';

const StatCard = ({ title, value, Icon, colorClass = 'text-text-primary' }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</span>
      <Icon size={18} className={colorClass} />
    </div>
    <div className={`mt-3 font-data text-3xl font-bold ${colorClass}`}>{value}</div>
  </div>
);

const PAGE_SIZE_DEFAULT = 25;

const applyDroneSearch = (request, text) => {
  const value = text.trim().replace(/,/g, ' ');
  if (!value) return request;

  return request.or([
    `model.ilike.%${value}%`,
    `serial_number.ilike.%${value}%`,
    `registration_number.ilike.%${value}%`,
    `manufacturer.ilike.%${value}%`,
    `home_base.ilike.%${value}%`,
  ].join(','));
};

const applyDroneFilter = (request, filter) => {
  if (filter === 'ready') return request.eq('status', 'Operational').eq('readiness_status', 'Ready');
  if (filter === 'assigned') return request.in('readiness_status', ['Assigned', 'In Mission']);
  if (filter === 'maintenance') return request.or('readiness_status.eq.Needs Maintenance,status.eq.Maintenance');
  if (filter === 'grounded') return request.in('status', ['Grounded', 'Decommissioned']);
  return request;
};

const DroneRegistryPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drones, setDrones] = useState([]);
  const [missions, setMissions] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, ready: 0, assigned: 0, maintenance: 0 });

  const fetchFleet = async () => {
    setIsLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let droneRequest = supabase
      .from('drones')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    droneRequest = applyDroneFilter(applyDroneSearch(droneRequest, query), activeFilter);

    const [droneResponse, totalResponse, readyResponse, assignedResponse, maintenanceResponse] = await Promise.all([
      droneRequest,
      supabase.from('drones').select('id', { count: 'exact', head: true }),
      supabase.from('drones').select('id', { count: 'exact', head: true }).eq('status', 'Operational').eq('readiness_status', 'Ready'),
      supabase.from('drones').select('id', { count: 'exact', head: true }).in('readiness_status', ['Assigned', 'In Mission']),
      supabase.from('drones').select('id', { count: 'exact', head: true }).or('readiness_status.eq.Needs Maintenance,status.eq.Maintenance'),
    ]);

    if (droneResponse.error) {
      console.error('Error fetching drones:', droneResponse.error);
      setDrones([]);
    } else {
      setDrones(droneResponse.data || []);
      setTotalCount(droneResponse.count || 0);
    }

    setStats({
      total: totalResponse.count || 0,
      ready: readyResponse.count || 0,
      assigned: assignedResponse.count || 0,
      maintenance: maintenanceResponse.count || 0,
    });

    const droneIds = (droneResponse.data || []).map((drone) => drone.id);
    if (droneIds.length === 0) {
      setMissions([]);
      setFlightLogs([]);
      setIsLoading(false);
      return;
    }

    const [missionResponse, logResponse] = await Promise.all([
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, drone_id')
        .in('drone_id', droneIds)
        .in('status', ['Scheduled', 'Active'])
        .order('date', { ascending: true }),
      supabase
        .from('flight_logs')
        .select('id, drone_id, log_date, duration_minutes, incident_reported')
        .in('drone_id', droneIds)
        .order('log_date', { ascending: false }),
    ]);

    if (!missionResponse.error) setMissions(missionResponse.data || []);
    if (!logResponse.error) setFlightLogs(logResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFleet();
  }, [activeFilter, page, pageSize, query]);

  const latestLogByDrone = useMemo(() => {
    const map = new Map();
    flightLogs.forEach((log) => {
      if (log.drone_id && !map.has(log.drone_id)) map.set(log.drone_id, log);
    });
    return map;
  }, [flightLogs]);

  const activeMissionByDrone = useMemo(() => {
    const map = new Map();
    missions.forEach((mission) => {
      if (mission.drone_id && !map.has(mission.drone_id)) map.set(mission.drone_id, mission);
    });
    return map;
  }, [missions]);

  const enrichedDrones = useMemo(() => (
    drones.map((drone) => {
      const activeMission = activeMissionByDrone.get(drone.id);
      const baseReadiness = getDroneReadiness(drone);
      const readiness = activeMission && ['Ready', 'Assigned'].includes(baseReadiness)
        ? activeMission.status === 'Active' ? 'In Mission' : 'Assigned'
        : baseReadiness;

      return {
        ...drone,
        readiness,
        serviceProgress: getServiceProgress(drone),
        hoursSinceService: getHoursSinceService(drone),
        maintenanceDue: isMaintenanceDue(drone),
        latestLog: latestLogByDrone.get(drone.id),
        activeMission,
      };
    })
  ), [activeMissionByDrone, drones, latestLogByDrone]);

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-text-primary">Fleet Management</h2>
          <p className="mt-1 text-sm text-text-muted">Onboard, inspect, assign, and retire drones from one operational view.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary inline-flex items-center justify-center gap-2 self-start px-4 py-2 text-sm uppercase tracking-wide xl:self-end"
        >
          <PlusCircle size={18} />
          Register New Drone
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Fleet" value={stats.total} Icon={PlaneTakeoff} />
        <StatCard title="Ready" value={stats.ready} Icon={CheckCircle2} colorClass="text-status-success" />
        <StatCard title="Assigned" value={stats.assigned} Icon={Clock} colorClass="text-accent" />
        <StatCard title="Maintenance" value={stats.maintenance} Icon={Wrench} colorClass="text-status-warning" />
      </div>

      <div className="card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search model, registration, serial, base..."
              className="input-field h-10 pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              ['all', 'All'],
              ['ready', 'Ready'],
              ['assigned', 'Assigned'],
              ['maintenance', 'Maintenance'],
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
          Loading fleet...
        </div>
      ) : enrichedDrones.length === 0 ? (
        <div className="card flex h-56 flex-col items-center justify-center text-center text-text-muted">
          <PlaneTakeoff className="mb-3 opacity-50" size={34} />
          <p className="font-semibold text-text-secondary">No drones match this view.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-left text-sm">
              <thead className="border-b border-border bg-bg-elevated/50 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="w-[20%] px-4 py-3 font-semibold">Drone</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Status</th>
                  <th className="w-[12%] px-4 py-3 font-semibold">Readiness</th>
                  <th className="w-[11%] px-4 py-3 font-semibold">Base</th>
                  <th className="w-[9%] px-4 py-3 font-semibold">Hours</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Service</th>
                  <th className="w-[10%] px-4 py-3 font-semibold">Next Service</th>
                  <th className="w-[8%] px-4 py-3 font-semibold">Assignment</th>
                  <th className="w-[10%] px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {enrichedDrones.map((drone, index) => {
                  const mission = drone.activeMission;
                  const readinessClass = getReadinessStyles(drone.readiness);
                  const assignment = mission
                    ? `${mission.name || mission.mission_identifier} (${formatDate(mission.date)})`
                    : 'Available';

                  return (
                    <tr key={drone.id} className={`transition-colors hover:bg-bg-elevated/40 ${index % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="truncate font-semibold text-text-primary">{drone.model || 'Unnamed Drone'}</div>
                        <div className="truncate font-data text-xs text-text-muted">{drone.registration_number || drone.serial_number || 'No registration'}</div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={drone.status} /></td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${readinessClass}`}>
                          {drone.readiness}
                        </span>
                      </td>
                      <td className="truncate px-4 py-4 text-text-secondary">{drone.home_base || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-data text-accent">{Number(drone.flight_hours || 0).toFixed(1)} h</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-data text-text-secondary">{drone.serviceProgress}%</span>
                          {drone.maintenanceDue && <AlertTriangle size={16} className="text-status-warning" />}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-data text-text-secondary">{formatDate(drone.next_maintenance_date)}</td>
                      <td className="truncate px-4 py-4 text-text-secondary">{assignment}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/drones/${drone.id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-accent/30 text-accent transition-colors hover:bg-accent/10"
                            title="View drone"
                            aria-label={`View ${drone.model || 'drone'}`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => navigate(`/drones/${drone.id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                            title="Service drone"
                            aria-label={`Service ${drone.model || 'drone'}`}
                          >
                            <Wrench size={15} />
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
          itemLabel="drones"
        />
      )}

      <DroneFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchFleet}
      />
    </div>
  );
};

export default DroneRegistryPage;
