import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Edit,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import DroneFormModal from '../components/drones/DroneFormModal';
import StatusBadge from '../components/ui/StatusBadge';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  formatDate,
  getDroneReadiness,
  getHoursSinceService,
  getReadinessStyles,
  getServiceProgress,
  isMaintenanceDue,
} from '../lib/droneLifecycle';

const todayInput = () => new Date().toISOString().split('T')[0];

const defaultNextService = () => {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0];
};

const fieldClass = 'w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent';

const Field = ({ label, value, mono = false }) => (
  <div className="flex flex-col gap-1 border-b border-border/50 py-3 sm:flex-row sm:items-start sm:justify-between">
    <span className="text-sm text-text-secondary">{label}</span>
    <span className={`text-left font-semibold text-text-primary sm:text-right ${mono ? 'font-data' : ''}`}>
      {value || '-'}
    </span>
  </div>
);

const DroneDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [drone, setDrone] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [missions, setMissions] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'Routine Inspection',
    scheduled_date: todayInput(),
    completed_date: todayInput(),
    next_service_date: defaultNextService(),
    technician: '',
    notes: '',
  });

  const fetchDrone = async () => {
    setIsLoading(true);

    const [droneResponse, logsResponse, missionsResponse, flightLogsResponse] = await Promise.all([
      supabase.from('drones').select('*').eq('id', id).single(),
      supabase
        .from('drone_maintenance_logs')
        .select('*')
        .eq('drone_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, location, pilot:pilot_id(full_name)')
        .eq('drone_id', id)
        .order('date', { ascending: false }),
      supabase
        .from('flight_logs')
        .select('id, log_date, duration_minutes, incident_reported, incident_details, mission:mission_id(name, mission_identifier)')
        .eq('drone_id', id)
        .order('log_date', { ascending: false }),
    ]);

    if (droneResponse.error) {
      console.error('Error fetching drone:', droneResponse.error);
      setDrone(null);
    } else {
      setDrone(droneResponse.data);
    }

    if (!logsResponse.error) setMaintenanceLogs(logsResponse.data || []);
    if (!missionsResponse.error) setMissions(missionsResponse.data || []);
    if (!flightLogsResponse.error) setFlightLogs(flightLogsResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDrone();
  }, [id]);

  const activeMission = useMemo(() => (
    missions.find((mission) => ['Scheduled', 'Active'].includes(mission.status))
  ), [missions]);

  const baseReadiness = getDroneReadiness(drone);
  const readiness = activeMission && ['Ready', 'Assigned'].includes(baseReadiness)
    ? activeMission.status === 'Active' ? 'In Mission' : 'Assigned'
    : baseReadiness;
  const readinessClass = getReadinessStyles(readiness);
  const serviceProgress = getServiceProgress(drone);
  const hoursSinceService = getHoursSinceService(drone);
  const maintenanceDue = isMaintenanceDue(drone);

  const updateDroneState = async (payload) => {
    const { error } = await supabase.from('drones').update(payload).eq('id', id);
    if (error) throw error;
  };

  const insertMaintenanceLog = async (payload) => {
    const { error } = await supabase.from('drone_maintenance_logs').insert({
      drone_id: id,
      created_by: user?.id || null,
      ...payload,
    });
    if (error) throw error;
  };

  const handleScheduleMaintenance = async () => {
    setActionError('');
    setActionLoading('schedule');

    try {
      await insertMaintenanceLog({
        maintenance_type: maintenanceForm.maintenance_type,
        status: 'Scheduled',
        scheduled_date: maintenanceForm.scheduled_date || todayInput(),
        technician: maintenanceForm.technician.trim() || null,
        notes: maintenanceForm.notes.trim() || null,
      });

      await updateDroneState({
        status: 'Maintenance',
        readiness_status: 'Needs Maintenance',
        next_maintenance_date: maintenanceForm.scheduled_date || todayInput(),
        maintenance_notes: maintenanceForm.notes.trim() || null,
      });

      await fetchDrone();
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'Failed to schedule maintenance.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCompleteMaintenance = async () => {
    setActionError('');
    setActionLoading('complete');

    try {
      await insertMaintenanceLog({
        maintenance_type: maintenanceForm.maintenance_type,
        status: 'Completed',
        scheduled_date: maintenanceForm.scheduled_date || null,
        completed_date: maintenanceForm.completed_date || todayInput(),
        technician: maintenanceForm.technician.trim() || null,
        notes: maintenanceForm.notes.trim() || null,
      });

      await updateDroneState({
        status: 'Operational',
        readiness_status: 'Ready',
        last_service_date: maintenanceForm.completed_date || todayInput(),
        last_service_hours: drone?.flight_hours || 0,
        next_maintenance_date: maintenanceForm.next_service_date || null,
        maintenance_notes: maintenanceForm.notes.trim() || null,
      });

      await fetchDrone();
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'Failed to complete maintenance.');
    } finally {
      setActionLoading('');
    }
  };

  const handleReadinessChange = async (mode) => {
    setActionError('');
    setActionLoading(mode);

    const payloads = {
      ready: { status: 'Operational', readiness_status: 'Ready' },
      grounded: { status: 'Grounded', readiness_status: 'Grounded' },
      retired: { status: 'Decommissioned', readiness_status: 'Decommissioned' },
    };

    try {
      await updateDroneState(payloads[mode]);
      await fetchDrone();
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'Failed to update drone readiness.');
    } finally {
      setActionLoading('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-text-muted">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Loading drone profile...
      </div>
    );
  }

  if (!drone) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-text-muted">Drone not found.</p>
        <button onClick={() => navigate('/drones')} className="text-sm text-accent hover:underline">
          Back to fleet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/drones')}
          className="inline-flex items-center gap-2 self-start text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back to fleet
        </button>
        <button
          onClick={() => setIsEditOpen(true)}
          className="inline-flex items-center justify-center gap-2 self-start rounded border border-accent/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10 sm:self-auto"
        >
          <Edit size={16} />
          Edit Profile
        </button>
      </div>

      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-data text-xs uppercase tracking-wide text-text-muted">
                {drone.registration_number || drone.serial_number}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${readinessClass}`}>
                {readiness}
              </span>
            </div>
            <h1 className="mt-2 break-words font-heading text-3xl font-bold uppercase tracking-wide text-text-primary">
              {drone.model}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
              <MapPin size={15} />
              {drone.home_base || 'No home base assigned'}
            </p>
          </div>
          <StatusBadge status={drone.status} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Clock size={15} />
              Flight Hours
            </div>
            <div className="mt-3 font-data text-3xl font-bold text-accent">{drone.flight_hours || 0}</div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Wrench size={15} />
              Since Service
            </div>
            <div className="mt-3 font-data text-3xl font-bold text-text-primary">{hoursSinceService.toFixed(1)}</div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Calendar size={15} />
              Next Service
            </div>
            <div className="mt-3 text-lg font-semibold text-text-primary">{formatDate(drone.next_maintenance_date)}</div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <ShieldCheck size={15} />
              Service Usage
            </div>
            <div className={`mt-3 font-data text-3xl font-bold ${maintenanceDue ? 'text-status-warning' : 'text-status-success'}`}>
              {serviceProgress}%
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
        <div className="space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Asset Profile</h2>
            <Field label="Manufacturer" value={drone.manufacturer} />
            <Field label="Type" value={drone.drone_type} />
            <Field label="Serial Number" value={drone.serial_number} mono />
            <Field label="Purchase Date" value={formatDate(drone.purchase_date)} />
            <Field label="Warranty Expiry" value={formatDate(drone.warranty_expiry)} />
            <Field label="Payload Capacity" value={drone.payload_capacity_kg ? `${drone.payload_capacity_kg} kg` : '-'} mono />
            <Field label="Max Flight Time" value={drone.max_flight_time_minutes ? `${drone.max_flight_time_minutes} minutes` : '-'} mono />
            <Field label="Battery Type" value={drone.battery_type} />
            <Field label="Firmware" value={drone.firmware_version} mono />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Compliance</h2>
            <Field label="Insurance Policy" value={drone.insurance_policy} mono />
            <Field label="Insurance Expiry" value={formatDate(drone.insurance_expiry)} />
            <Field label="Certification Ref" value={drone.certification_reference} mono />
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Flight History</h2>
              <span className="font-data text-xs text-text-muted">{flightLogs.length} logs</span>
            </div>
            {flightLogs.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No flight logs have been submitted for this drone.</div>
            ) : (
              <div className="space-y-3">
                {flightLogs.slice(0, 5).map((log) => (
                  <button
                    key={log.id}
                    onClick={() => navigate(`/flight-logs/${log.id}`)}
                    className="w-full rounded border border-border bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-elevated/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text-primary">{log.mission?.name || log.mission?.mission_identifier || 'Flight log'}</div>
                        <div className="mt-1 text-xs text-text-muted">{formatDate(log.log_date)} - {log.duration_minutes || 0} minutes</div>
                      </div>
                      {log.incident_reported ? <AlertTriangle size={18} className="text-status-danger" /> : <CheckCircle size={18} className="text-status-success" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Mission Assignments</h2>
              <span className="font-data text-xs text-text-muted">{missions.length} missions</span>
            </div>
            {missions.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No missions have used this drone yet.</div>
            ) : (
              <div className="space-y-3">
                {missions.slice(0, 5).map((mission) => (
                  <button
                    key={mission.id}
                    onClick={() => navigate(`/missions/${mission.id}`)}
                    className="w-full rounded border border-border bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-elevated/40"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text-primary">{mission.name || mission.mission_identifier}</div>
                        <div className="mt-1 text-xs text-text-muted">{mission.location || '-'} - {formatDate(mission.date)}</div>
                      </div>
                      <StatusBadge status={mission.status === 'Active' ? 'In Progress' : mission.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Readiness Control</h2>

            {activeMission && (
              <button
                onClick={() => navigate(`/missions/${activeMission.id}`)}
                className="mb-4 flex w-full items-start gap-3 rounded border border-accent/30 bg-accent/10 p-3 text-left text-accent"
              >
                <ClipboardList size={18} className="mt-0.5 shrink-0" />
                <span className="text-sm">
                  Assigned to {activeMission.name || activeMission.mission_identifier} on {formatDate(activeMission.date)}
                </span>
              </button>
            )}

            {maintenanceDue && (
              <div className="mb-4 flex items-start gap-3 rounded border border-status-warning/20 bg-status-warning/10 p-3 text-status-warning">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <span className="text-sm">This drone is due for service before it should be assigned again.</span>
              </div>
            )}

            {actionError && (
              <div className="mb-4 rounded border border-status-danger/20 bg-status-danger/10 p-3 text-sm text-status-danger">
                {actionError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleReadinessChange('ready')}
                disabled={!!actionLoading || !!activeMission || maintenanceDue}
                className="inline-flex items-center justify-center gap-2 rounded border border-status-success/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-status-success transition-colors hover:bg-status-success/10 disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Return to Ready
              </button>
              <button
                onClick={() => handleReadinessChange('grounded')}
                disabled={!!actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded border border-status-danger/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-50"
              >
                <XCircle size={16} />
                Ground Drone
              </button>
              <button
                onClick={() => handleReadinessChange('retired')}
                disabled={!!actionLoading || !!activeMission}
                className="inline-flex items-center justify-center gap-2 rounded border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
              >
                <FileText size={16} />
                Retire Asset
              </button>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Maintenance Action</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Maintenance Type</label>
                <select
                  value={maintenanceForm.maintenance_type}
                  onChange={(e) => setMaintenanceForm((form) => ({ ...form, maintenance_type: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="Routine Inspection">Routine Inspection</option>
                  <option value="Battery Service">Battery Service</option>
                  <option value="Firmware Update">Firmware Update</option>
                  <option value="Propulsion Repair">Propulsion Repair</option>
                  <option value="Incident Repair">Incident Repair</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Scheduled</label>
                  <input type="date" value={maintenanceForm.scheduled_date} onChange={(e) => setMaintenanceForm((form) => ({ ...form, scheduled_date: e.target.value }))} className={fieldClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Completed</label>
                  <input type="date" value={maintenanceForm.completed_date} onChange={(e) => setMaintenanceForm((form) => ({ ...form, completed_date: e.target.value }))} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Next Service</label>
                <input type="date" value={maintenanceForm.next_service_date} onChange={(e) => setMaintenanceForm((form) => ({ ...form, next_service_date: e.target.value }))} className={fieldClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Technician</label>
                <input value={maintenanceForm.technician} onChange={(e) => setMaintenanceForm((form) => ({ ...form, technician: e.target.value }))} className={fieldClass} placeholder="Technician or service provider" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</label>
                <textarea value={maintenanceForm.notes} onChange={(e) => setMaintenanceForm((form) => ({ ...form, notes: e.target.value }))} rows={4} className={`${fieldClass} resize-none`} placeholder="Work required or work completed..." />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={handleScheduleMaintenance}
                  disabled={!!actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded border border-status-warning/30 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-status-warning transition-colors hover:bg-status-warning/10 disabled:opacity-50"
                >
                  <Wrench size={16} />
                  Schedule
                </button>
                <button
                  onClick={handleCompleteMaintenance}
                  disabled={!!actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {actionLoading === 'complete' ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  Complete
                </button>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Maintenance History</h2>
            {maintenanceLogs.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No maintenance activity recorded.</div>
            ) : (
              <div className="space-y-3">
                {maintenanceLogs.map((log) => (
                  <div key={log.id} className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-text-primary">{log.maintenance_type}</div>
                      <StatusBadge status={log.status} />
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      Scheduled {formatDate(log.scheduled_date)} - Completed {formatDate(log.completed_date)}
                    </div>
                    {log.technician && <div className="mt-1 text-xs text-text-secondary">Technician: {log.technician}</div>}
                    {log.notes && <p className="mt-2 text-sm text-text-secondary">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <DroneFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        drone={drone}
        onSave={fetchDrone}
      />
    </div>
  );
};

export default DroneDetailPage;
