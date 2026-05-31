import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Notebook,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardCheck,
  Play,
  FileCheck,
  XCircle,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { createNotification } from '../lib/notifications';
import { getFlightLogReview } from '../lib/flightLogReview';
import { ACTIVE_MISSION_STATUS, getMissionStatusLabel, getMissionWorkflowStatus } from '../lib/missionStatus';
import { isMaintenanceDue } from '../lib/droneLifecycle';
import { getPilotRestingReadiness } from '../lib/pilotLifecycle';

const preflightItems = [
  { id: 'briefing', label: 'Mission briefing reviewed' },
  { id: 'airframe', label: 'Drone airframe, propellers, and payload checked' },
  { id: 'battery', label: 'Battery and controller levels confirmed' },
  { id: 'weather', label: 'Weather and visibility acceptable' },
  { id: 'airspace', label: 'Location and airspace risks checked' },
];

const formatDate = (date) => {
  if (!date) return '-';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '-';
  return parsedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const Field = ({ label, value, mono = false }) => (
  <div className="py-3 border-b border-border/50 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
    <span className="text-text-secondary text-sm">{label}</span>
    <span className={`text-text-primary font-semibold text-left sm:text-right break-words ${mono ? 'font-data' : ''}`}>
      {value || '-'}
    </span>
  </div>
);

const MissionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [mission, setMission] = useState(null);
  const [flightLog, setFlightLog] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchMission = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        pilot:pilot_id(id, full_name, licence_expiry, medical_expiry, status, readiness_status, next_training_date, next_currency_check),
        drone:drone_id(id, model, serial_number, status, readiness_status, next_maintenance_date, flight_hours, maintenance_interval_hours, last_service_hours)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error(error);
      setMission(null);
      setIsLoading(false);
      return;
    }

    setMission(data);

    const { data: logData, error: logError } = await supabase
      .from('flight_logs')
      .select('id, log_date, duration_minutes, incident_reported, approved_by, weather_conditions, review_status, reviewed_by, reviewed_at, review_notes')
      .eq('mission_id', id)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!logError) setFlightLog(logData || null);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMission();
  }, [id]);

  const getDroneStatusForMission = (nextStatus) => {
    if (nextStatus === ACTIVE_MISSION_STATUS) {
      return { status: 'Operational', readiness_status: 'In Mission' };
    }

    if (nextStatus === 'Completed' || nextStatus === 'Cancelled') {
      return isMaintenanceDue(mission.drone)
        ? { status: 'Maintenance', readiness_status: 'Needs Maintenance' }
        : { status: 'Operational', readiness_status: 'Ready' };
    }

    return { status: 'Operational', readiness_status: 'Assigned' };
  };

  const getPilotReadinessForMission = (nextStatus) => {
    if (nextStatus === ACTIVE_MISSION_STATUS) return 'In Mission';
    if (nextStatus === 'Completed' || nextStatus === 'Cancelled') {
      return getPilotRestingReadiness(mission.pilot);
    }
    return 'Assigned';
  };

  const updateMissionStatus = async (nextStatus) => {
    const displayStatus = getMissionStatusLabel(nextStatus);
    setActionError('');
    setActionLoading(displayStatus);

    const { error } = await supabase
      .from('missions')
      .update({ status: nextStatus })
      .eq('id', mission.id);

    if (error) {
      setActionError(error.message);
      setActionLoading('');
      return false;
    }

    setMission((current) => ({ ...current, status: nextStatus }));
    setActionLoading('');

    if (mission.drone_id) {
      const { error: droneError } = await supabase
        .from('drones')
        .update(getDroneStatusForMission(nextStatus))
        .eq('id', mission.drone_id);

      if (droneError) console.error('Failed to update drone readiness:', droneError);
    }

    if (mission.pilot_id) {
      const { error: pilotError } = await supabase
        .from('profiles')
        .update({ readiness_status: getPilotReadinessForMission(nextStatus) })
        .eq('id', mission.pilot_id);

      if (pilotError) console.error('Failed to update pilot readiness:', pilotError);
    }

    if (mission.created_by && mission.created_by !== user?.id) {
      const notificationType = nextStatus === ACTIVE_MISSION_STATUS
        ? 'mission_started'
        : nextStatus === 'Completed'
          ? 'mission_completed'
          : 'mission_update';

      await createNotification({
        recipientId: mission.created_by,
        title: `Mission ${displayStatus.toLowerCase()}`,
        content: `${mission.pilot?.full_name || 'The assigned pilot'} moved "${mission.name || mission.mission_identifier}" to ${displayStatus}.`,
        missionId: mission.id,
        actorId: user?.id,
        type: notificationType,
        priority: nextStatus === 'Cancelled' ? 'critical' : 'normal',
      });
    }

    return true;
  };

  const togglePreflightItem = (itemId) => {
    setCheckedItems((items) => ({ ...items, [itemId]: !items[itemId] }));
  };

  const handleStartMission = async () => {
    const updated = await updateMissionStatus(ACTIVE_MISSION_STATUS);
    if (updated) setCheckedItems({});
  };

  const handleCompleteMission = async () => {
    const updated = await updateMissionStatus('Completed');
    if (updated) navigate(`/flight-logs/new?mission_id=${mission.id}`);
  };

  const handleAbortMission = async () => {
    await updateMissionStatus('Cancelled');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-text-muted">
        Loading mission...
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="space-y-4 text-center py-12">
        <p className="text-text-muted">Mission not found.</p>
        <button onClick={() => navigate('/missions')} className="text-accent text-sm hover:underline">
          Back to Missions
        </button>
      </div>
    );
  }

  const isPilotOwnMission = user?.role === 'pilot' && mission.pilot_id === user?.id;
  const workflowStatus = getMissionWorkflowStatus(mission.status);
  const canOperateMission = isPilotOwnMission && !['Completed', 'Cancelled'].includes(workflowStatus);
  const canLogFlight = workflowStatus === 'Completed' && !flightLog && (isPilotOwnMission || user?.role !== 'pilot');
  const allPreflightChecked = preflightItems.every((item) => checkedItems[item.id]);

  const today = new Date();
  const licenceExpiry = mission.pilot?.licence_expiry ? new Date(mission.pilot.licence_expiry) : null;
  const medicalExpiry = mission.pilot?.medical_expiry ? new Date(mission.pilot.medical_expiry) : null;
  const licenceExpired = licenceExpiry && licenceExpiry < today;
  const medicalExpired = medicalExpiry && medicalExpiry < today;
  const hasPilotCertIssue = licenceExpired || medicalExpired;
  const flightLogReview = flightLog ? getFlightLogReview(flightLog) : null;
  const logStatus = flightLogReview ? flightLogReview.label : 'Pending review';

  const steps = [
    {
      label: 'Assigned',
      complete: ['Scheduled', 'In Progress', 'Completed'].includes(workflowStatus),
      active: workflowStatus === 'Scheduled',
    },
    {
      label: 'In progress',
      complete: ['In Progress', 'Completed'].includes(workflowStatus),
      active: workflowStatus === 'In Progress',
    },
    {
      label: 'Flight complete',
      complete: workflowStatus === 'Completed',
      active: workflowStatus === 'Completed' && !flightLog,
    },
    {
      label: 'Log submitted',
      complete: !!flightLog,
      active: !!flightLog && flightLogReview?.status === 'pending',
    },
    {
      label: 'Reviewed',
      complete: !!flightLogReview && flightLogReview.status !== 'pending',
      active: !!flightLogReview && flightLogReview.status !== 'pending',
    },
  ];

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <button
        onClick={() => navigate('/missions')}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="card p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide mb-1 break-words">
              {mission.name || mission.mission_identifier}
            </h1>
            <p className="text-text-muted text-sm">
              {mission.type || 'Mission'} - {mission.location || 'No location'}
            </p>
          </div>
          <StatusBadge status={getMissionStatusLabel(mission.status)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`rounded border p-3 ${
                step.complete
                  ? 'border-status-success/30 bg-status-success/10 text-status-success'
                  : step.active
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border bg-bg-primary text-text-muted'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-data text-xs">{String(index + 1).padStart(2, '0')}</span>
                {step.complete ? <CheckCircle size={16} /> : <Clock size={16} />}
              </div>
              <div className="mt-2 font-sans text-xs font-semibold uppercase tracking-wide">{step.label}</div>
            </div>
          ))}
        </div>

        {actionError && (
          <div className="p-4 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 flex items-start gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm">{actionError}</span>
          </div>
        )}

        {hasPilotCertIssue && (
          <div className="p-4 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 flex items-start gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Pilot certification issue</p>
              {licenceExpired && <p>RPAS licence expired on {licenceExpiry.toLocaleDateString()}</p>}
              {medicalExpired && <p>Medical certificate expired on {medicalExpiry.toLocaleDateString()}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] gap-6">
          <div className="space-y-6 min-w-0">
            <section>
              <h2 className="font-heading text-lg font-semibold text-text-primary uppercase tracking-wide mb-3">
                Mission Briefing
              </h2>
              <div className="space-y-0">
                <Field label="Assigned Pilot" value={mission.pilot?.full_name} />
                <Field label="Drone Model" value={mission.drone?.model} />
                <Field label="Serial Number" value={mission.drone?.serial_number} mono />
                <Field label="Scheduled Date" value={formatDate(mission.date)} mono />
                <Field label="Location" value={mission.location} />
              </div>
            </section>

            {mission.notes && (
              <section className="pt-4 border-t border-border">
                <h3 className="font-semibold text-text-primary mb-2">Instructions</h3>
                <div className="bg-bg-primary p-4 rounded text-text-secondary text-sm leading-relaxed">
                  {mission.notes}
                </div>
              </section>
            )}
          </div>

          <aside className="rounded border border-border bg-bg-primary/50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-accent" />
              <h2 className="font-heading text-base font-semibold text-text-primary uppercase tracking-wide">
                Pilot Workspace
              </h2>
            </div>

            {workflowStatus === 'Cancelled' && (
              <div className="p-3 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 flex items-start gap-2 text-sm">
                <XCircle size={16} className="mt-0.5 shrink-0" />
                This mission has been cancelled.
              </div>
            )}

            {canOperateMission && workflowStatus === 'Scheduled' && (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Review the briefing, complete the pre-flight checks, then start the mission.
                </p>
                <div className="space-y-2">
                  {preflightItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded border border-border bg-bg-elevated/30 p-3 text-sm text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item.id]}
                        onChange={() => togglePreflightItem(item.id)}
                        className="mt-1 accent-current"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleStartMission}
                  disabled={!allPreflightChecked || !!actionLoading || hasPilotCertIssue}
                  className="w-full btn-primary inline-flex items-center justify-center gap-2 py-2.5 text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={16} />
                  {actionLoading === 'In Progress' ? 'Starting...' : 'Start Mission'}
                </button>
              </div>
            )}

            {canOperateMission && workflowStatus === 'In Progress' && (
              <div className="space-y-4">
                <div className="p-3 rounded bg-status-warning/10 text-status-warning border border-status-warning/20 flex items-start gap-2 text-sm">
                  <Clock size={16} className="mt-0.5 shrink-0" />
                  Mission is active. Complete it when flight operations are finished.
                </div>
                <button
                  onClick={handleCompleteMission}
                  disabled={!!actionLoading}
                  className="w-full btn-primary inline-flex items-center justify-center gap-2 py-2.5 text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileCheck size={16} />
                  {actionLoading === 'Completed' ? 'Completing...' : 'Complete and Log Flight'}
                </button>
                <button
                  onClick={handleAbortMission}
                  disabled={!!actionLoading}
                  className="w-full rounded border border-status-danger/30 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-status-danger hover:bg-status-danger/10 transition-colors disabled:opacity-50"
                >
                  Abort Mission
                </button>
              </div>
            )}

            {canLogFlight && (
              <div className="space-y-3">
                <div className="p-3 rounded bg-accent/10 text-accent border border-accent/20 flex items-start gap-2 text-sm">
                  <Notebook size={16} className="mt-0.5 shrink-0" />
                  Flight is complete. Submit the official flight log to finish the operational record.
                </div>
                <button
                  onClick={() => navigate(`/flight-logs/new?mission_id=${mission.id}`)}
                  className="w-full btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-sm uppercase tracking-wide"
                >
                  <Notebook size={16} />
                  Submit Flight Log
                </button>
              </div>
            )}

            {flightLog && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-secondary">Flight log</span>
                  <StatusBadge status={logStatus} />
                </div>
                <div className="rounded border border-border bg-bg-elevated/30 p-3 text-sm text-text-secondary">
                  <div className="font-semibold text-text-primary">{formatDate(flightLog.log_date)}</div>
                  <div>{flightLog.duration_minutes || 0} minutes</div>
                  {flightLog.incident_reported && <div className="mt-1 text-status-danger">Incident reported</div>}
                </div>
                <button
                  onClick={() => navigate(`/flight-logs/${flightLog.id}`)}
                  className="w-full rounded border border-accent/30 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent hover:bg-accent/10 transition-colors"
                >
                  View Flight Log
                </button>
              </div>
            )}

            {!isPilotOwnMission && workflowStatus !== 'Cancelled' && (
              <p className="text-sm text-text-muted">
                The assigned pilot will complete the pre-flight checks, start the mission, complete it, and submit the flight log from this workspace.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default MissionDetailPage;
