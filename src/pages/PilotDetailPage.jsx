import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Edit,
  FileText,
  IdCard,
  Loader2,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import PilotFormPanel from '../components/pilots/PilotFormPanel';
import StatusBadge from '../components/ui/StatusBadge';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ACTIVE_MISSION_STATUS, getMissionStatusLabel } from '../lib/missionStatus';
import {
  formatDate,
  getDaysUntil,
  getPilotCertificationState,
  getPilotCurrencyState,
  getPilotReadiness,
  getPilotReadinessStyles,
  getPilotRestingReadiness,
} from '../lib/pilotLifecycle';

const todayInput = () => new Date().toISOString().split('T')[0];

const defaultNextCheck = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
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

const getInitials = (name) => (
  name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'P'
);

const PilotDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [pilot, setPilot] = useState(null);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [missions, setMissions] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [trainingForm, setTrainingForm] = useState({
    activity_type: 'Currency Check',
    status: 'Completed',
    activity_date: todayInput(),
    expiry_date: defaultNextCheck(),
    instructor: '',
    notes: '',
  });

  const fetchPilot = async () => {
    setIsLoading(true);

    const [pilotResponse, trainingResponse, missionsResponse, logsResponse] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('pilot_training_logs')
        .select('*')
        .eq('pilot_id', id)
        .order('activity_date', { ascending: false }),
      supabase
        .from('missions')
        .select('id, name, mission_identifier, date, status, location, type, drone:drone_id(model, serial_number)')
        .eq('pilot_id', id)
        .order('date', { ascending: false }),
      supabase
        .from('flight_logs')
        .select('id, log_date, duration_minutes, incident_reported, incident_details, review_status, mission:mission_id(name, mission_identifier), drone:drone_id(model, serial_number)')
        .eq('pilot_id', id)
        .order('log_date', { ascending: false }),
    ]);

    if (pilotResponse.error) {
      console.error('Error fetching pilot:', pilotResponse.error);
      setPilot(null);
    } else {
      setPilot(pilotResponse.data);
    }

    if (!trainingResponse.error) setTrainingLogs(trainingResponse.data || []);
    if (!missionsResponse.error) setMissions(missionsResponse.data || []);
    if (!logsResponse.error) setFlightLogs(logsResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPilot();
  }, [id]);

  const activeMission = useMemo(() => (
    missions.find((mission) => ['Scheduled', ACTIVE_MISSION_STATUS].includes(mission.status))
  ), [missions]);

  const readiness = getPilotReadiness(pilot, activeMission);
  const readinessClass = getPilotReadinessStyles(readiness);
  const certificationState = getPilotCertificationState(pilot);
  const currencyState = getPilotCurrencyState(pilot);
  const licenceDays = getDaysUntil(pilot?.licence_expiry);
  const medicalDays = getDaysUntil(pilot?.medical_expiry);
  const canReturnReady = !activeMission && readiness !== 'Ready';

  const updatePilotState = async (payload) => {
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) throw error;
  };

  const handleReadinessChange = async (mode) => {
    setActionError('');
    setActionLoading(mode);

    try {
      if (mode === 'ready') {
        const candidate = { ...pilot, status: 'Active', readiness_status: 'Ready' };
        const restingReadiness = getPilotRestingReadiness(candidate);
        if (restingReadiness !== 'Ready') {
          setActionError('Pilot has expired certification or overdue currency. Record the renewal before returning to Ready.');
          return;
        }
        await updatePilotState({ status: 'Active', readiness_status: 'Ready', last_grounded_reason: null });
      }

      if (mode === 'grounded') {
        await updatePilotState({
          status: 'Active',
          readiness_status: 'Grounded',
          last_grounded_reason: trainingForm.notes.trim() || 'Manually grounded by operations',
        });
      }

      if (mode === 'suspended') {
        await updatePilotState({
          status: 'Suspended',
          readiness_status: 'Grounded',
          last_grounded_reason: trainingForm.notes.trim() || 'Pilot account suspended',
        });
      }

      await fetchPilot();
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'Failed to update pilot readiness.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRecordTraining = async () => {
    setActionError('');
    setActionLoading('training');

    try {
      const logPayload = {
        pilot_id: id,
        activity_type: trainingForm.activity_type,
        status: trainingForm.status,
        activity_date: trainingForm.activity_date || todayInput(),
        expiry_date: trainingForm.expiry_date || null,
        instructor: trainingForm.instructor.trim() || null,
        notes: trainingForm.notes.trim() || null,
        created_by: user?.id || null,
      };

      const { error: logError } = await supabase.from('pilot_training_logs').insert(logPayload);
      if (logError) throw logError;

      if (trainingForm.status === 'Completed') {
        const profileUpdate = {};

        if (trainingForm.activity_type === 'Currency Check') {
          profileUpdate.last_currency_check = trainingForm.activity_date || todayInput();
          profileUpdate.next_currency_check = trainingForm.expiry_date || null;
        }

        if (trainingForm.activity_type === 'Recurrent Training') {
          profileUpdate.last_training_date = trainingForm.activity_date || todayInput();
          profileUpdate.next_training_date = trainingForm.expiry_date || null;
        }

        if (trainingForm.activity_type === 'Licence Renewal') {
          profileUpdate.licence_expiry = trainingForm.expiry_date || pilot.licence_expiry;
        }

        if (trainingForm.activity_type === 'Medical Renewal') {
          profileUpdate.medical_expiry = trainingForm.expiry_date || pilot.medical_expiry;
        }

        const updatedPilot = { ...pilot, ...profileUpdate, status: 'Active', readiness_status: 'Ready' };
        profileUpdate.status = 'Active';
        profileUpdate.readiness_status = activeMission
          ? activeMission.status === ACTIVE_MISSION_STATUS ? 'In Mission' : 'Assigned'
          : getPilotRestingReadiness(updatedPilot);

        await updatePilotState(profileUpdate);
      }

      await fetchPilot();
    } catch (error) {
      console.error(error);
      setActionError(error.message || 'Failed to record pilot training.');
    } finally {
      setActionLoading('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-text-muted">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Loading pilot profile...
      </div>
    );
  }

  if (!pilot) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-text-muted">Pilot not found.</p>
        <button onClick={() => navigate('/pilots')} className="text-sm text-accent hover:underline">
          Back to pilots
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/pilots')}
          className="inline-flex items-center gap-2 self-start text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back to pilots
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
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated font-heading text-xl font-bold text-text-primary">
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
                  {readiness}
                </span>
              </div>
              <h1 className="mt-2 break-words font-heading text-3xl font-bold uppercase tracking-wide text-text-primary">
                {pilot.full_name}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
                <MapPin size={15} />
                {pilot.base_location || 'No home base assigned'}
              </p>
            </div>
          </div>
          <StatusBadge status={pilot.status} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Clock size={15} />
              Flight Hours
            </div>
            <div className="mt-3 font-data text-3xl font-bold text-accent">{Number(pilot.total_flight_hours || 0).toFixed(1)}</div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <IdCard size={15} />
              Category
            </div>
            <div className="mt-3 font-data text-xl font-bold text-text-primary">{pilot.category || '-'}</div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <ShieldCheck size={15} />
              Certification
            </div>
            <div className={`mt-3 text-lg font-semibold ${certificationState === 'expired' ? 'text-status-danger' : certificationState === 'expiring' ? 'text-status-warning' : 'text-status-success'}`}>
              {certificationState === 'missing' ? 'Not set' : certificationState}
            </div>
          </div>
          <div className="rounded border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Calendar size={15} />
              Currency
            </div>
            <div className={`mt-3 text-lg font-semibold ${currencyState === 'due' ? 'text-status-danger' : currencyState === 'upcoming' ? 'text-status-warning' : 'text-text-primary'}`}>
              {currencyState}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
        <div className="space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Pilot Profile</h2>
            <Field label="Email" value={pilot.email} />
            <Field label="Phone" value={pilot.phone} />
            <Field label="Licence Number" value={pilot.licence_number} mono />
            <Field label="Licence Expiry" value={`${formatDate(pilot.licence_expiry)}${licenceDays !== null ? ` (${licenceDays < 0 ? `${Math.abs(licenceDays)} days overdue` : `${licenceDays} days remaining`})` : ''}`} />
            <Field label="Medical Expiry" value={`${formatDate(pilot.medical_expiry)}${medicalDays !== null ? ` (${medicalDays < 0 ? `${Math.abs(medicalDays)} days overdue` : `${medicalDays} days remaining`})` : ''}`} />
            <Field label="Minimum Recent Hours" value={pilot.minimum_currency_hours ? `${pilot.minimum_currency_hours} h` : '-'} mono />
            <Field label="Last Currency Check" value={formatDate(pilot.last_currency_check)} />
            <Field label="Next Currency Check" value={formatDate(pilot.next_currency_check)} />
            <Field label="Last Training" value={formatDate(pilot.last_training_date)} />
            <Field label="Next Training" value={formatDate(pilot.next_training_date)} />
            <Field label="Emergency Contact" value={[pilot.emergency_contact_name, pilot.emergency_contact_phone].filter(Boolean).join(' - ')} />
          </section>

          {pilot.pilot_notes && (
            <section className="card p-5">
              <h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Operational Notes</h2>
              <p className="text-sm leading-relaxed text-text-secondary">{pilot.pilot_notes}</p>
            </section>
          )}

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Mission Assignments</h2>
              <span className="font-data text-xs text-text-muted">{missions.length} missions</span>
            </div>
            {missions.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No missions have been assigned to this pilot.</div>
            ) : (
              <div className="space-y-3">
                {missions.slice(0, 6).map((mission) => (
                  <button
                    key={mission.id}
                    onClick={() => navigate(`/missions/${mission.id}`)}
                    className="w-full rounded border border-border bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-elevated/40"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text-primary">{mission.name || mission.mission_identifier}</div>
                        <div className="mt-1 text-xs text-text-muted">{mission.location || '-'} - {formatDate(mission.date)}</div>
                        <div className="mt-1 text-xs text-text-secondary">{mission.drone?.model || 'No drone'} {mission.drone?.serial_number ? `(${mission.drone.serial_number})` : ''}</div>
                      </div>
                      <StatusBadge status={getMissionStatusLabel(mission.status)} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Flight History</h2>
              <span className="font-data text-xs text-text-muted">{flightLogs.length} logs</span>
            </div>
            {flightLogs.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No flight logs have been submitted by this pilot.</div>
            ) : (
              <div className="space-y-3">
                {flightLogs.slice(0, 6).map((log) => (
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
        </div>

        <aside className="space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Readiness Control</h2>

            {activeMission && (
              <button
                onClick={() => navigate(`/missions/${activeMission.id}`)}
                className="mb-4 flex w-full items-start gap-3 rounded border border-accent/30 bg-accent/10 p-3 text-left text-accent"
              >
                <ClipboardCheck size={18} className="mt-0.5 shrink-0" />
                <span className="text-sm">
                  Assigned to {activeMission.name || activeMission.mission_identifier} on {formatDate(activeMission.date)}
                </span>
              </button>
            )}

            {pilot.last_grounded_reason && readiness === 'Grounded' && (
              <div className="mb-4 rounded border border-status-danger/20 bg-status-danger/10 p-3 text-sm text-status-danger">
                {pilot.last_grounded_reason}
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
                disabled={!!actionLoading || !canReturnReady}
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
                Ground Pilot
              </button>
              <button
                onClick={() => handleReadinessChange('suspended')}
                disabled={!!actionLoading || !!activeMission}
                className="inline-flex items-center justify-center gap-2 rounded border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
              >
                <FileText size={16} />
                Suspend Account
              </button>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Compliance Action</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Activity Type</label>
                <select
                  value={trainingForm.activity_type}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, activity_type: event.target.value }))}
                  className={fieldClass}
                >
                  <option value="Currency Check">Currency Check</option>
                  <option value="Recurrent Training">Recurrent Training</option>
                  <option value="Licence Renewal">Licence Renewal</option>
                  <option value="Medical Renewal">Medical Renewal</option>
                  <option value="Incident Review">Incident Review</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</label>
                <select
                  value={trainingForm.status}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, status: event.target.value }))}
                  className={fieldClass}
                >
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Failed">Failed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Activity Date</label>
                  <input type="date" value={trainingForm.activity_date} onChange={(event) => setTrainingForm((form) => ({ ...form, activity_date: event.target.value }))} className={`${fieldClass} [color-scheme:dark]`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Next Due</label>
                  <input type="date" value={trainingForm.expiry_date} onChange={(event) => setTrainingForm((form) => ({ ...form, expiry_date: event.target.value }))} className={`${fieldClass} [color-scheme:dark]`} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Instructor</label>
                <input value={trainingForm.instructor} onChange={(event) => setTrainingForm((form) => ({ ...form, instructor: event.target.value }))} className={fieldClass} placeholder="Instructor or reviewer" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</label>
                <textarea value={trainingForm.notes} onChange={(event) => setTrainingForm((form) => ({ ...form, notes: event.target.value }))} rows={4} className={`${fieldClass} resize-none`} placeholder="Result, limitation, or action required" />
              </div>
              <button
                onClick={handleRecordTraining}
                disabled={!!actionLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {actionLoading === 'training' ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Record Activity
              </button>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-heading text-lg font-bold uppercase tracking-wide text-text-primary">Training History</h2>
            {trainingLogs.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-sm text-text-muted">No training or compliance activity recorded.</div>
            ) : (
              <div className="space-y-3">
                {trainingLogs.map((log) => (
                  <div key={log.id} className="rounded border border-border bg-bg-primary p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-text-primary">{log.activity_type}</div>
                      <StatusBadge status={log.status} />
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      Activity {formatDate(log.activity_date)} - Next due {formatDate(log.expiry_date)}
                    </div>
                    {log.instructor && <div className="mt-1 text-xs text-text-secondary">Instructor: {log.instructor}</div>}
                    {log.notes && <p className="mt-2 text-sm text-text-secondary">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <PilotFormPanel
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        pilot={pilot}
        onSave={fetchPilot}
      />
    </div>
  );
};

export default PilotDetailPage;
