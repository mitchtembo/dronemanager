import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { createNotification } from '../lib/notifications';
import { ACTIVE_MISSION_STATUS } from '../lib/missionStatus';
import { isMaintenanceDue } from '../lib/droneLifecycle';
import { getPilotRestingReadiness } from '../lib/pilotLifecycle';
import { cleanMultilineText, cleanText, finiteNumber, nullableText } from '../lib/inputSanitizers';

const LabeledField = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="block font-sans text-xs text-text-secondary font-semibold uppercase tracking-wide">
      {label}{required && ' *'}
    </label>
    {children}
  </div>
);

const FlightLogFormPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missionIdFromUrl = searchParams.get('mission_id');
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const isPilot = user?.role === 'pilot';

  const [form, setForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    mission_type: 'Surveying',
    mission_id: missionIdFromUrl || '',
    drone_id: '',
    departure_location: '',
    landing_location: '',
    duration_minutes: '',
    max_altitude_meters: '',
    distance_covered_km: '',
    weather_conditions: 'Clear',
    incident_reported: false,
    incident_details: '',
  });

  const [drones, setDrones] = useState([]);
  const [missions, setMissions] = useState([]);
  const [linkedMission, setLinkedMission] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading || !isPilot) return;

    fetchDrones();
    fetchMissions();
    if (missionIdFromUrl) fetchLinkedMission(missionIdFromUrl);
  }, [authLoading, isPilot, missionIdFromUrl]);

  const applyMissionToForm = (mission) => {
    setLinkedMission(mission);
    setForm(f => ({
      ...f,
      mission_id: mission.id,
      mission_type: mission.type || f.mission_type,
      drone_id: mission.drone_id || f.drone_id,
      departure_location: mission.location || f.departure_location,
    }));
  };

  const fetchDrones = async () => {
    const { data, error } = await supabase
      .from('drones')
      .select('id, model, serial_number')
      .eq('status', 'Operational');
    if (error) {
      console.error('Error fetching drones:', error);
    }
    setDrones(data || []);
  };

  const fetchMissions = async () => {
    let query = supabase
      .from('missions')
      .select('id, name, mission_identifier, type, location, drone_id, date, status, created_by')
      .in('status', ['Scheduled', ACTIVE_MISSION_STATUS, 'Completed'])
      .order('date', { ascending: false });
    query = query.eq('pilot_id', user.id);
    const { data } = await query;
    const assignedMissions = data || [];
    setMissions(assignedMissions);

    if (!missionIdFromUrl && assignedMissions.length === 1) {
      applyMissionToForm(assignedMissions[0]);
    }
  };

  const fetchLinkedMission = async (mId) => {
    const { data } = await supabase
      .from('missions')
      .select('id, name, mission_identifier, type, location, drone_id, status, created_by')
      .eq('id', mId)
      .eq('pilot_id', user.id)
      .single();
    if (data) {
      applyMissionToForm(data);
    }
  };

  const handleMissionSelect = (mId) => {
    setForm(f => ({ ...f, mission_id: mId }));
    if (!mId) {
      setLinkedMission(null);
      return;
    }
    const selected = missions.find(m => String(m.id) === String(mId));
    if (selected) {
      applyMissionToForm(selected);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!isPilot) {
      setError('Only pilots can submit flight logs.');
      return;
    }
    const durationMinutes = finiteNumber(form.duration_minutes);
    const maxAltitudeMeters = finiteNumber(form.max_altitude_meters);
    const distanceCoveredKm = finiteNumber(form.distance_covered_km);
    const departureLocation = cleanText(form.departure_location, { max: 180 });
    const landingLocation = nullableText(form.landing_location, { max: 180 });
    const incidentDetails = cleanMultilineText(form.incident_details, { max: 2000 });
    const weatherCondition = cleanText(form.weather_conditions, { max: 80 });

    if (!form.mission_id || !form.drone_id || !departureLocation || durationMinutes === null || maxAltitudeMeters === null || !form.log_date) {
      setError('Please fill in all required fields.');
      return;
    }
    if (durationMinutes < 1 || durationMinutes > 1440) {
      setError('Flight duration must be at least 1 minute.');
      return;
    }
    if (maxAltitudeMeters < 1 || maxAltitudeMeters > 10000) {
      setError('Maximum altitude must be at least 1 meter.');
      return;
    }
    if (distanceCoveredKm !== null && (distanceCoveredKm < 0 || distanceCoveredKm > 100000)) {
      setError('Distance covered must be a valid positive value.');
      return;
    }
    if (form.incident_reported && !incidentDetails) {
      setError('Please describe the incident in the incident details field.');
      return;
    }

    const selectedMission = linkedMission || missions.find(m => String(m.id) === String(form.mission_id));

    setIsSubmitting(true);

    // STEP 1 - Insert flight log
    const { data: newLog, error: logError } = await supabase
      .from('flight_logs')
      .insert({
        pilot_id: user.id,
        mission_id: form.mission_id,
        drone_id: form.drone_id,
        mission_type: selectedMission?.type || form.mission_type,
        log_date: form.log_date,
        max_altitude_meters: maxAltitudeMeters,
        distance_covered_km: distanceCoveredKm,
        departure_location: departureLocation,
        landing_location: landingLocation,
        duration_minutes: Math.round(durationMinutes),
        weather_conditions: { condition: weatherCondition },
        incident_reported: form.incident_reported,
        incident_details: form.incident_reported ? incidentDetails : null,
        review_status: 'pending',
      })
      .select()
      .single();

    if (logError) {
      setError(logError.message);
      setIsSubmitting(false);
      return;
    }

    // STEP 2 - Update pilot total_flight_hours
    const { data: pilot } = await supabase
      .from('profiles')
      .select('id, status, readiness_status, total_flight_hours, licence_expiry, medical_expiry, next_training_date, next_currency_check')
      .eq('id', user.id)
      .single();

    if (pilot) {
      const newHours = (parseFloat(pilot.total_flight_hours) || 0) + (durationMinutes / 60);
      const updatedPilot = {
        ...pilot,
        total_flight_hours: parseFloat(newHours.toFixed(2)),
        readiness_status: 'Ready',
      };
      const { error: pilotUpdateError } = await supabase
        .from('profiles')
        .update({
          total_flight_hours: updatedPilot.total_flight_hours,
          readiness_status: getPilotRestingReadiness(updatedPilot),
        })
        .eq('id', pilot.id);

      if (pilotUpdateError) {
        // Roll back the flight log if hours update fails
        await supabase.from('flight_logs').delete().eq('id', newLog.id);
        setError('Failed to update flight hours. Log has been rolled back. Please try again.');
        setIsSubmitting(false);
        return;
      }
    }

    // STEP 3 - Update drone flight_hours and readiness
    const { data: drone } = await supabase
      .from('drones')
      .select('id, flight_hours, status, readiness_status, next_maintenance_date, maintenance_interval_hours, last_service_hours')
      .eq('id', form.drone_id)
      .single();

    if (drone) {
      const newDroneHours = (parseFloat(drone.flight_hours) || 0) + (durationMinutes / 60);
      const updatedDrone = { ...drone, flight_hours: parseFloat(newDroneHours.toFixed(2)) };
      const serviceDue = isMaintenanceDue(updatedDrone);
      await supabase
        .from('drones')
        .update({
          flight_hours: updatedDrone.flight_hours,
          status: serviceDue ? 'Maintenance' : 'Operational',
          readiness_status: serviceDue ? 'Needs Maintenance' : 'Ready',
        })
        .eq('id', drone.id);
    }

    if (form.mission_id) {
      await supabase
        .from('missions')
        .update({ status: 'Completed' })
        .eq('id', form.mission_id);

      if (selectedMission?.created_by && selectedMission.created_by !== user.id) {
        await createNotification({
          recipientId: selectedMission.created_by,
          title: form.incident_reported ? 'Incident reported' : 'Flight log submitted',
          content: form.incident_reported
            ? `${user.fullName || user.email || 'A pilot'} reported an incident on "${selectedMission.name || selectedMission.mission_identifier}": ${incidentDetails}`
            : `${user.fullName || user.email || 'A pilot'} submitted a flight log for "${selectedMission.name || selectedMission.mission_identifier}".`,
          missionId: form.mission_id,
          flightLogId: newLog.id,
          droneId: form.drone_id,
          actorId: user.id,
          type: form.incident_reported ? 'incident_reported' : 'flight_log_submitted',
          priority: form.incident_reported ? 'critical' : 'action',
        });
      }
    }

    setIsSubmitting(false);
    setSuccess(true);
    setTimeout(() => navigate(`/flight-logs/${newLog.id}`), 1500);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-text-muted">
        Loading flight log form...
      </div>
    );
  }

  if (!isPilot) {
    return (
      <div className="space-y-6 min-w-0 pb-6">
        <button
          onClick={() => navigate('/flight-logs')}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back to flight logs
        </button>
        <div className="card p-6 space-y-4">
          <div className="p-4 rounded bg-status-warning/10 text-status-warning border border-status-warning/20 flex items-start gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="font-heading text-xl font-bold text-text-primary uppercase tracking-wide">
                Pilot-only action
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Flight logs are submitted by pilots after assigned missions. Admins and managers can only review, approve, or decline submitted logs.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/flight-logs')}
            className="btn-primary px-4 py-2 text-sm uppercase tracking-wide"
          >
            Review Submitted Logs
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 text-center">
        <CheckCircle size={48} className="text-status-success" />
        <h2 className="text-2xl font-bold text-text-primary">Flight log submitted</h2>
        <p className="text-text-muted">
          Your flight hours have been updated. Redirecting to the submitted log...
        </p>
      </div>
    );
  }

  const inputClass = "w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent";
  const missionOptions = linkedMission && !missions.some(m => String(m.id) === String(linkedMission.id))
    ? [linkedMission, ...missions]
    : missions;

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div>
        <button
          onClick={() => navigate('/flight-logs')}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors text-sm mb-4"
        >
          <ArrowLeft size={16} />
          Back to flight logs
        </button>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">
            {linkedMission ? 'Mission Flight Log' : 'New Flight Log'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Submit the operational record after the mission is complete. Linked mission fields are kept consistent with the assignment.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 flex items-start gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {linkedMission && missionIdFromUrl && (
          <div className="p-3 rounded bg-accent/10 text-accent border border-accent/20 text-sm">
            Pre-filled from mission: <span className="font-semibold">{linkedMission.name || linkedMission.mission_identifier}</span>. Submitting this log moves the mission into review.
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LabeledField label="Flight Date" required>
              <input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} className={inputClass} />
            </LabeledField>

            <LabeledField label="Mission Type" required>
              {linkedMission ? (
                <div className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary">
                  {form.mission_type}
                </div>
              ) : (
                <select
                  value={form.mission_type}
                  onChange={e => setForm(f => ({ ...f, mission_type: e.target.value }))}
                  className={inputClass}
                >
                  <option value="Surveying">Surveying</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Agricultural Spraying">Agricultural Spraying</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Media">Media</option>
                  <option value="Search & Rescue">Search & Rescue</option>
                  <option value="Other">Other</option>
                </select>
              )}
            </LabeledField>

            <LabeledField label="Drone" required>
              <select
                value={form.drone_id}
                onChange={e => setForm(f => ({ ...f, drone_id: e.target.value }))}
                disabled={!!linkedMission?.drone_id}
                className={`${inputClass} ${linkedMission?.drone_id ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">Select drone...</option>
                {drones.map(d => (
                  <option key={d.id} value={d.id}>{d.model} - {d.serial_number}</option>
                ))}
              </select>
            </LabeledField>

            <LabeledField label="Link to Mission">
              <select
                value={form.mission_id}
                onChange={e => handleMissionSelect(e.target.value)}
                disabled={!!missionIdFromUrl}
                className={`${inputClass} ${missionIdFromUrl ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">Select mission...</option>
                {missionOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.mission_identifier} - {m.date}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted">
                Only missions assigned to you are available here.
              </p>
            </LabeledField>

            <LabeledField label="Departure Location" required>
              <input
                type="text"
                value={form.departure_location}
                onChange={e => setForm(f => ({ ...f, departure_location: e.target.value }))}
                placeholder="e.g. Gweru Aerodrome"
                disabled={!!linkedMission}
                className={`${inputClass} ${linkedMission ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </LabeledField>

            <LabeledField label="Landing Location">
              <input
                type="text"
                value={form.landing_location}
                onChange={e => setForm(f => ({ ...f, landing_location: e.target.value }))}
                placeholder="e.g. Gweru Aerodrome"
                className={inputClass}
              />
            </LabeledField>

            <LabeledField label="Flight Duration (minutes)" required>
              <input
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="e.g. 45"
                className={inputClass}
              />
            </LabeledField>

            <LabeledField label="Maximum Altitude (meters)" required>
              <input
                type="number"
                min="1"
                step="0.1"
                value={form.max_altitude_meters}
                onChange={e => setForm(f => ({ ...f, max_altitude_meters: e.target.value }))}
                placeholder="e.g. 120"
                className={inputClass}
              />
            </LabeledField>

            <LabeledField label="Distance Covered (km)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.distance_covered_km}
                onChange={e => setForm(f => ({ ...f, distance_covered_km: e.target.value }))}
                placeholder="e.g. 8.5"
                className={inputClass}
              />
            </LabeledField>

            <LabeledField label="Weather Conditions">
              <select
                value={form.weather_conditions}
                onChange={e => setForm(f => ({ ...f, weather_conditions: e.target.value }))}
                className={inputClass}
              >
                <option value="Clear">Clear</option>
                <option value="Overcast">Overcast</option>
                <option value="Light Wind">Light Wind</option>
                <option value="Strong Wind">Strong Wind</option>
                <option value="Rain">Rain</option>
                <option value="Other">Other</option>
              </select>
            </LabeledField>
          </div>

          {/* Incident toggle */}
          <div className="flex items-center gap-3 py-3 px-4 rounded bg-bg-primary border border-border">
            <div
              onClick={() => setForm(f => ({ ...f, incident_reported: !f.incident_reported }))}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.incident_reported ? 'bg-status-danger' : 'bg-border'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${form.incident_reported ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-semibold text-text-primary">Incident occurred</span>
          </div>

          {form.incident_reported && (
            <div className="space-y-2">
              <textarea
                value={form.incident_details}
                onChange={e => setForm(f => ({ ...f, incident_details: e.target.value }))}
                rows={4}
                placeholder="Describe what happened in detail - location, nature of incident, actions taken, damage assessment..."
                className={`${inputClass} resize-none`}
              />
              <p className="text-text-muted text-xs">This will be flagged for manager review.</p>
            </div>
          )}
        </div>

        {/* Form actions */}
        <div className="flex gap-4 pt-4 border-t border-border">
          <button onClick={() => navigate('/flight-logs')} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded transition-colors font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Flight Log'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlightLogFormPage;
