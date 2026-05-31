import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MapPin,
  PlaneTakeoff,
  PlusCircle,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import DroneFormModal from '../components/drones/DroneFormModal';
import { supabase } from '../lib/supabase';
import {
  formatDate,
  getDroneReadiness,
  getHoursSinceService,
  getReadinessStyles,
  getServiceProgress,
  isDroneAssignable,
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

const DroneRegistryPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drones, setDrones] = useState([]);
  const [missions, setMissions] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchFleet = async () => {
    setIsLoading(true);
    const [droneResponse, missionResponse, logResponse] = await Promise.all([
      supabase.from('drones').select('*').order('created_at', { ascending: false }),
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, drone_id')
        .in('status', ['Scheduled', 'Active'])
        .order('date', { ascending: true }),
      supabase
        .from('flight_logs')
        .select('id, drone_id, log_date, duration_minutes, incident_reported')
        .order('log_date', { ascending: false }),
    ]);

    if (droneResponse.error) {
      console.error('Error fetching drones:', droneResponse.error);
      setDrones([]);
    } else {
      setDrones(droneResponse.data || []);
    }

    if (!missionResponse.error) setMissions(missionResponse.data || []);
    if (!logResponse.error) setFlightLogs(logResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFleet();
  }, []);

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

  const stats = useMemo(() => ({
    total: drones.length,
    ready: enrichedDrones.filter((drone) => drone.readiness === 'Ready' && isDroneAssignable(drone)).length,
    assigned: enrichedDrones.filter((drone) => ['Assigned', 'In Mission'].includes(drone.readiness)).length,
    maintenance: enrichedDrones.filter((drone) => drone.readiness === 'Needs Maintenance').length,
  }), [drones.length, enrichedDrones]);

  const filteredDrones = useMemo(() => {
    const text = query.trim().toLowerCase();

    return enrichedDrones.filter((drone) => {
      if (activeFilter !== 'all') {
        if (activeFilter === 'ready' && !(drone.readiness === 'Ready' && isDroneAssignable(drone))) return false;
        if (activeFilter === 'assigned' && !['Assigned', 'In Mission'].includes(drone.readiness)) return false;
        if (activeFilter === 'maintenance' && drone.readiness !== 'Needs Maintenance') return false;
        if (activeFilter === 'grounded' && !['Grounded', 'Decommissioned'].includes(drone.readiness)) return false;
      }

      if (!text) return true;
      return [
        drone.model,
        drone.serial_number,
        drone.registration_number,
        drone.manufacturer,
        drone.home_base,
      ].some((value) => (value || '').toLowerCase().includes(text));
    });
  }, [activeFilter, enrichedDrones, query]);

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
              onChange={(e) => setQuery(e.target.value)}
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
          Loading fleet...
        </div>
      ) : filteredDrones.length === 0 ? (
        <div className="card flex h-56 flex-col items-center justify-center text-center text-text-muted">
          <PlaneTakeoff className="mb-3 opacity-50" size={34} />
          <p className="font-semibold text-text-secondary">No drones match this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredDrones.map((drone) => {
            const mission = drone.activeMission;
            const latestLog = drone.latestLog;
            const readinessClass = getReadinessStyles(drone.readiness);

            return (
              <article key={drone.id} className="card min-w-0 overflow-hidden p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-data text-xs uppercase tracking-wide text-text-muted">
                        {drone.registration_number || drone.serial_number}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${readinessClass}`}>
                        {drone.readiness}
                      </span>
                    </div>
                    <h3 className="mt-2 truncate font-heading text-xl font-bold uppercase tracking-wide text-text-primary">
                      {drone.model}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                      <MapPin size={14} />
                      {drone.home_base || 'No base assigned'}
                    </p>
                  </div>
                  <StatusBadge status={drone.status} />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <Clock size={14} />
                      Flight Hours
                    </div>
                    <div className="mt-2 font-data text-2xl font-bold text-accent">{drone.flight_hours || 0}</div>
                  </div>
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <Wrench size={14} />
                      Service Used
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="font-data text-2xl font-bold text-text-primary">{drone.serviceProgress}%</span>
                      {drone.maintenanceDue && <AlertTriangle size={18} className="mb-1 text-status-warning" />}
                    </div>
                  </div>
                  <div className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <Calendar size={14} />
                      Next Service
                    </div>
                    <div className="mt-2 text-sm font-semibold text-text-primary">{formatDate(drone.next_maintenance_date)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="rounded border border-border/70 bg-bg-elevated/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Assignment</div>
                    <div className="mt-1 text-text-primary">
                      {mission ? `${mission.name || mission.mission_identifier} (${formatDate(mission.date)})` : 'Available for scheduling'}
                    </div>
                  </div>
                  <div className="rounded border border-border/70 bg-bg-elevated/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Last Flight</div>
                    <div className="mt-1 text-text-primary">
                      {latestLog ? `${formatDate(latestLog.log_date)} - ${latestLog.duration_minutes || 0} min` : 'No flight log yet'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                  <button
                    onClick={() => navigate(`/drones/${drone.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-accent/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                  <button
                    onClick={() => navigate(`/drones/${drone.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  >
                    {drone.maintenanceDue ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                    {drone.maintenanceDue ? 'Service Due' : 'Maintenance'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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
