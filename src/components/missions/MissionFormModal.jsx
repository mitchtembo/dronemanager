import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { createNotification } from '../../lib/notifications';
import { ACTIVE_MISSION_STATUS } from '../../lib/missionStatus';
import { formatDate, getDroneReadiness, isMaintenanceDue } from '../../lib/droneLifecycle';
import { getDaysUntil, getPilotBlockReason, getPilotRestingReadiness } from '../../lib/pilotLifecycle';
import { cleanEnum, cleanMultilineText, cleanText } from '../../lib/inputSanitizers';

const MISSION_TYPES = ['Surveying', 'Inspection', 'Agricultural Spraying', 'Delivery', 'Media', 'Search & Rescue', 'Other'];
const MISSION_STATUSES = ['Scheduled', ACTIVE_MISSION_STATUS, 'Completed', 'Cancelled'];

const MissionFormModal = ({ isOpen, onClose, onSave, mission }) => {
  const { user } = useContext(AuthContext);
  const isEditing = !!mission;

  const [form, setForm] = useState({
    name: '',
    type: 'Surveying',
    pilot_id: '',
    drone_id: '',
    date: '',
    location: '',
    notes: '',
    status: 'Scheduled',
  });

  const [pilots, setPilots] = useState([]);
  const [drones, setDrones] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [pilotCertStatus, setPilotCertStatus] = useState(null);
  const [conflictError, setConflictError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function fetchPilots() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, licence_number, category, licence_expiry, medical_expiry, status, readiness_status, next_training_date, next_currency_check, total_flight_hours')
      .eq('role', 'pilot')
      .order('full_name', { ascending: true });
    setPilots(data || []);
  }

  async function fetchDrones() {
    const { data, error: droneError } = await supabase
      .from('drones')
      .select('id, model, serial_number, status, readiness_status, next_maintenance_date, flight_hours, maintenance_interval_hours, last_service_hours');

    if (droneError) {
      console.error('Error fetching drones:', droneError);
      setDrones([]);
      return;
    }

    setDrones(data || []);

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('missions')
      .select('id, name, mission_identifier, date, status, pilot_id, drone_id')
      .in('status', ['Scheduled', ACTIVE_MISSION_STATUS]);

    if (assignmentError) {
      console.error('Error fetching active assignments:', assignmentError);
      setActiveAssignments([]);
      return;
    }

    setActiveAssignments(assignmentData || []);
  }

  useEffect(() => {
    if (isOpen) {
      fetchPilots();
      fetchDrones();
      if (mission) {
        setForm({
          name: mission.name || mission.mission_identifier || '',
          type: mission.type || 'Surveying',
          pilot_id: mission.pilot_id || '',
          drone_id: mission.drone_id || '',
          date: mission.date || '',
          location: mission.location || '',
          notes: mission.notes || '',
          status: mission.status || 'Scheduled',
        });
      } else {
        setForm({ name: '', type: 'Surveying', pilot_id: '', drone_id: '', date: '', location: '', notes: '', status: 'Scheduled' });
      }
      setPilotCertStatus(null);
      setConflictError('');
      setError('');
    }
  }, [isOpen, mission]);

  const handlePilotChange = (pilotId) => {
    setForm(f => ({ ...f, pilot_id: pilotId }));
    setPilotCertStatus(null);
    setConflictError('');
    if (!pilotId) return;

    const selected = pilots.find(p => p.id === pilotId);
    if (!selected) return;

    const pilotBlockReason = getPilotOptionBlockReason(selected);
    if (pilotBlockReason) {
      setPilotCertStatus({ type: 'expired', message: `${pilotBlockReason} Cannot assign.` });
      return;
    }

    const licenceDays = getDaysUntil(selected.licence_expiry);
    const medicalDays = getDaysUntil(selected.medical_expiry);

    if ((licenceDays !== null && licenceDays <= 90) || (medicalDays !== null && medicalDays <= 90)) {
      const which = licenceDays !== null && licenceDays <= 90 ? `RPAS licence (${licenceDays}d)` : `Medical cert (${medicalDays}d)`;
      setPilotCertStatus({ type: 'expiring', message: `Warning: ${which} expiring soon. Mission allowed but pilot must renew.` });
    } else {
      setPilotCertStatus({ type: 'valid', message: 'Pilot is ready for assignment.' });
    }
  };

  const checkSchedulingConflict = async (pilotId, date) => {
    if (!pilotId || !date) return false;
    const { data } = await supabase
      .from('missions')
      .select('id, name')
      .eq('pilot_id', pilotId)
      .eq('date', date)
      .neq('status', 'Cancelled');

    if (isEditing) {
      const conflicts = (data || []).filter(m => m.id !== mission.id);
      return conflicts.length > 0;
    }
    return (data || []).length > 0;
  };

  const getMissionDroneReadiness = (missionStatus) => {
    if (missionStatus === ACTIVE_MISSION_STATUS) return 'In Mission';
    if (missionStatus === 'Scheduled') return 'Assigned';
    return 'Ready';
  };

  const getMissionPilotReadiness = (missionStatus) => {
    if (missionStatus === ACTIVE_MISSION_STATUS) return 'In Mission';
    if (missionStatus === 'Scheduled') return 'Assigned';
    return 'Ready';
  };

  const getPilotOptionBlockReason = (pilot) => {
    if (!pilot) return '';
    const isCurrentPilot = isEditing && pilot.id === mission.pilot_id;
    const candidate = isCurrentPilot ? { ...pilot, readiness_status: 'Ready' } : pilot;
    const readinessReason = getPilotBlockReason(candidate);
    if (readinessReason) return readinessReason;

    const booking = activeAssignments.find((item) => (
      item.pilot_id === pilot.id &&
      item.date === form.date &&
      (!isEditing || item.id !== mission.id)
    ));

    if (booking) {
      return `Booked for ${booking.name || booking.mission_identifier} on ${formatDate(booking.date)}.`;
    }

    return '';
  };

  const getReleasedPilotReadiness = (pilotId) => {
    const releasedPilot = pilots.find((pilot) => pilot.id === pilotId);
    return getPilotRestingReadiness(releasedPilot || { status: 'Active', readiness_status: 'Ready' });
  };

  const getDroneBlockReason = (drone) => {
    if (!drone) return '';
    if (isEditing && drone.id === mission.drone_id) return '';
    if (drone.status !== 'Operational') return `Status is ${drone.status}.`;
    if (getDroneReadiness(drone) !== 'Ready') return `Readiness is ${getDroneReadiness(drone)}.`;
    if (isMaintenanceDue(drone)) return 'Maintenance is due.';

    const booking = activeAssignments.find((item) => (
      item.drone_id === drone.id &&
      item.date === form.date &&
      (!isEditing || item.id !== mission.id)
    ));

    if (booking) {
      return `Booked for ${booking.name || booking.mission_identifier} on ${formatDate(booking.date)}.`;
    }

    return '';
  };

  const handleSubmit = async () => {
    setError('');
    setConflictError('');

    const sanitizedName = cleanText(form.name, { max: 160 });
    const sanitizedLocation = cleanText(form.location, { max: 180 });
    const sanitizedNotes = cleanMultilineText(form.notes, { max: 2000 });

    if (!sanitizedName || !form.pilot_id || !form.drone_id || !form.date || !sanitizedLocation) {
      setError('Please fill in all required fields.');
      return;
    }

    const selectedPilot = pilots.find((pilot) => pilot.id === form.pilot_id);
    const pilotBlockReason = getPilotOptionBlockReason(selectedPilot);
    if (pilotBlockReason) {
      setError(`Selected pilot is not assignable. ${pilotBlockReason}`);
      return;
    }

    const hasConflict = await checkSchedulingConflict(form.pilot_id, form.date);
    if (hasConflict) {
      setConflictError('This pilot already has a mission scheduled on this date.');
      return;
    }

    const selectedDrone = drones.find((drone) => drone.id === form.drone_id);
    const droneBlockReason = getDroneBlockReason(selectedDrone);
    if (droneBlockReason) {
      setError(`Selected drone is not assignable. ${droneBlockReason}`);
      return;
    }

    setIsSubmitting(true);

    const missionName = sanitizedName;

    const payload = {
      name: missionName,
      mission_identifier: missionName,
      type: cleanEnum(form.type, MISSION_TYPES, 'Other'),
      pilot_id: form.pilot_id,
      drone_id: form.drone_id,
      date: form.date,
      location: sanitizedLocation,
      notes: sanitizedNotes,
      status: isEditing ? cleanEnum(form.status, MISSION_STATUSES, 'Scheduled') : 'Scheduled',
    };

    if (isEditing) {
      const { error: updateError } = await supabase
        .from('missions')
        .update(payload)
        .eq('id', mission.id)
        .select()
        .single();
      if (updateError) { setError(updateError.message); setIsSubmitting(false); return; }

      if (mission.drone_id && mission.drone_id !== form.drone_id) {
        await supabase
          .from('drones')
          .update({ status: 'Operational', readiness_status: 'Ready' })
          .eq('id', mission.drone_id);
      }

      if (mission.pilot_id && mission.pilot_id !== form.pilot_id) {
        await supabase
          .from('profiles')
          .update({ readiness_status: getReleasedPilotReadiness(mission.pilot_id) })
          .eq('id', mission.pilot_id);
      }

      if (form.drone_id) {
        await supabase
          .from('drones')
          .update({
            status: 'Operational',
            readiness_status: getMissionDroneReadiness(form.status),
          })
          .eq('id', form.drone_id);
      }

      if (form.pilot_id) {
        await supabase
          .from('profiles')
          .update({ readiness_status: getMissionPilotReadiness(form.status) })
          .eq('id', form.pilot_id);
      }
    } else {
      payload.created_by = user?.id;
      const { data: savedMission, error: insertError } = await supabase
        .from('missions')
        .insert(payload)
        .select()
        .single();
      if (insertError) { setError(insertError.message); setIsSubmitting(false); return; }

      await supabase
        .from('drones')
        .update({ status: 'Operational', readiness_status: 'Assigned' })
        .eq('id', form.drone_id);

      await supabase
        .from('profiles')
        .update({ readiness_status: 'Assigned' })
        .eq('id', form.pilot_id);

      await createNotification({
        recipientId: form.pilot_id,
        title: 'Mission assigned',
        content: `You have been assigned to mission "${missionName}" on ${new Date(form.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
        missionId: savedMission?.id,
        droneId: form.drone_id,
        actorId: user?.id,
        type: 'mission_assigned',
        priority: 'action',
      });
    }

    setIsSubmitting(false);
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  const availablePilots = pilots.filter((pilot) => !getPilotOptionBlockReason(pilot));
  const currentPilot = isEditing ? pilots.find((pilot) => pilot.id === mission.pilot_id) : null;
  const pilotOptions = currentPilot && !availablePilots.some((pilot) => pilot.id === currentPilot.id)
    ? [currentPilot, ...availablePilots]
    : availablePilots;
  const selectedPilot = pilots.find((pilot) => pilot.id === form.pilot_id);
  const selectedPilotWarning = selectedPilot ? getPilotOptionBlockReason(selectedPilot) : '';
  const isBlocked = pilotCertStatus?.type === 'expired' || !!selectedPilotWarning;
  const availableDrones = drones.filter((drone) => !getDroneBlockReason(drone));
  const currentDrone = isEditing ? drones.find((drone) => drone.id === mission.drone_id) : null;
  const droneOptions = currentDrone && !availableDrones.some((drone) => drone.id === currentDrone.id)
    ? [currentDrone, ...availableDrones]
    : availableDrones;
  const selectedDrone = drones.find((drone) => drone.id === form.drone_id);
  const selectedDroneWarning = selectedDrone ? getDroneBlockReason(selectedDrone) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-bg-elevated border border-border shadow-2xl rounded-lg w-full max-w-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <h2 className="font-heading text-xl uppercase tracking-wider text-text-primary">
            {isEditing ? 'Edit Mission' : 'Create Mission'}
          </h2>
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6">
          {error && (
            <div className="p-3 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Mission Name */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Mission Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Gweru Survey Run 3"
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Mission Type */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Mission Type *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="Surveying">Surveying</option>
              <option value="Inspection">Inspection</option>
              <option value="Agricultural Spraying">Agricultural Spraying</option>
              <option value="Delivery">Delivery</option>
              <option value="Media">Media</option>
              <option value="Search & Rescue">Search & Rescue</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Assign Pilot */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Assign Pilot *</label>
            <select
              value={form.pilot_id}
              onChange={e => handlePilotChange(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select a pilot...</option>
              {pilotOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.category ? ` - ${p.category}` : ''}{p.readiness_status ? ` (${p.readiness_status})` : ''}
                </option>
              ))}
            </select>

            {/* Cert status feedback */}
            {(pilotCertStatus || selectedPilotWarning) && (
              <div className={`mt-2 p-2.5 rounded text-xs flex items-start gap-2 ${
                selectedPilotWarning || pilotCertStatus?.type === 'expired' ? 'bg-status-danger/10 text-status-danger border border-status-danger/20' :
                pilotCertStatus?.type === 'expiring' ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                'bg-status-success/10 text-status-success border border-status-success/20'
              }`}>
                {pilotCertStatus?.type === 'valid' && !selectedPilotWarning
                  ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                }
                {selectedPilotWarning || pilotCertStatus?.message}
              </div>
            )}
            {pilotOptions.length === 0 && (
              <p className="mt-1 text-xs text-status-warning">No ready pilots are available for this date.</p>
            )}
          </div>

          {/* Assign Drone */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Assign Drone *</label>
            <select
              value={form.drone_id}
              onChange={e => setForm(f => ({ ...f, drone_id: e.target.value }))}
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select a drone...</option>
              {droneOptions.map(d => (
                <option key={d.id} value={d.id}>{d.model} - {d.serial_number}</option>
              ))}
            </select>
            {selectedDroneWarning && (
              <p className="mt-1 text-xs text-status-warning">{selectedDroneWarning}</p>
            )}
            {!selectedDroneWarning && form.date && (
              <p className="mt-1 text-xs text-text-muted">
                Showing ready drones with no mission conflict on {formatDate(form.date)}.
              </p>
            )}
            {droneOptions.length === 0 && (
              <p className="mt-1 text-xs text-status-warning">No ready drones are available for this date.</p>
            )}
          </div>

          {/* Date and Location side by side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-sans text-xs text-text-secondary mb-2">Scheduled Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setConflictError(''); }}
                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
              {conflictError && (
                <p className="text-status-danger text-xs mt-1">{conflictError}</p>
              )}
            </div>
            <div>
              <label className="block font-sans text-xs text-text-secondary mb-2">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                disabled={!isEditing}
                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="Scheduled">Scheduled</option>
                <option value={ACTIVE_MISSION_STATUS}>In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Location *</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Gweru, Midlands Province"
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-sans text-xs text-text-secondary mb-2">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Additional mission instructions..."
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 md:p-6 border-t border-border justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text-primary border border-border rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isBlocked}
            className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Mission'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionFormModal;
