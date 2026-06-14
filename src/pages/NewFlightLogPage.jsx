import { useEffect, useState, useContext } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, AlertCircle, Cloud, Thermometer, Wind, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { cleanMultilineText } from '../lib/inputSanitizers';

const logSchema = z.object({
  date: z.date({
    required_error: "Date is required"
  }),
  pilotId: z.string().min(1, "Pilot is required"),
  droneId: z.string().min(1, "Drone is required"),
  missionId: z.string().optional(),
  duration: z.number().min(1, "Duration must be at least 1 min").max(1000),
  maxAltitude: z.number().min(0, "Altitude must be non-negative").max(500),
  temperature: z.number().min(-50).max(60),
  windSpeed: z.number().min(0).max(50),
  visibility: z.string().trim().min(1, "Visibility is required").max(80),
  incidentReported: z.boolean(),
  notes: z.string().max(2000).optional(),
});

const NewFlightLogPage = () => {
  const navigate = useNavigate();
  const [availablePilots, setAvailablePilots] = useState([]);
  const [availableDrones, setAvailableDrones] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);
  const { user, isLoading: authLoading } = useContext(AuthContext);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(logSchema),
    defaultValues: {
      date: new Date(),
      pilotId: '',
      droneId: '',
      missionId: '',
      duration: 30,
      maxAltitude: 120,
      temperature: 25,
      windSpeed: 5,
      visibility: 'Clear',
      incidentReported: false,
      notes: ''
    }
  });

  const hasIncident = watch('incidentReported');

  useEffect(() => {
    const fetchOptions = async () => {
      if (user?.role === 'pilot') {
        // Pilot view: include every mission assigned to this pilot and the aircraft used by those missions
        const missionsRes = await supabase
          .from('missions')
          .select('id, mission_identifier, drone_id, status, date')
          .eq('pilot_id', user.id)
          .order('date', { ascending: false });

        const missions = missionsRes.data || [];
        setAvailableMissions(
          missions.map((m) => ({
            id: m.id,
            name: `${m.mission_identifier || m.id}${m.status ? ` (${m.status})` : ''}`,
          }))
        );

        // Extract unique drone ids
        const droneIds = [...new Set(missions.map(m => m.drone_id).filter(Boolean))];
        let drones = [];
        if (droneIds.length > 0) {
          const dronesRes = await supabase.from('drones').select('id, serial_number, model').in('id', droneIds);
          drones = dronesRes.data || [];
        }

        setAvailableDrones(drones.map(d => ({ id: d.id, name: `${d.serial_number} (${d.model})` })));
        setAvailablePilots([{ id: user.id, name: user.fullName }]);
      } else {
        // Admin/Manager view: full lists
        const [pilotsRes, dronesRes, missionsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name').eq('role', 'pilot').order('full_name'),
          supabase.from('drones').select('id, serial_number, model').order('serial_number'),
          supabase.from('missions').select('id, mission_identifier').order('created_at', { ascending: false }).limit(100)
        ]);

        if (pilotsRes.data) {
          setAvailablePilots(
            pilotsRes.data.map((pilot) => ({
              id: pilot.id,
              name: pilot.full_name,
            }))
          );
        }

        if (dronesRes.data) {
          setAvailableDrones(
            dronesRes.data.map((drone) => ({
              id: drone.id,
              name: `${drone.serial_number} (${drone.model})`,
            }))
          );
        }

        if (missionsRes.data) {
          setAvailableMissions(missionsRes.data.map(m => ({ id: m.id, name: m.mission_identifier || m.id })));
        }
      }
    };

    if (!authLoading) fetchOptions();
  }, [user, authLoading]);

  // When pilot logs in, default pilotId to current user
  useEffect(() => {
    if (!authLoading && user?.role === 'pilot') {
      setValue('pilotId', user.id);
    }
  }, [user, authLoading, setValue]);

  useEffect(() => {
    if (user?.role !== 'pilot') return;

    if (availableMissions.length === 1) {
      setValue('missionId', availableMissions[0].id);
    }

    if (availableDrones.length === 1) {
      setValue('droneId', availableDrones[0].id);
    }
  }, [availableMissions, availableDrones, user, setValue]);

  // When pilotId changes (admin selecting a pilot), load missions/drones for that pilot
  const selectedPilotId = watch('pilotId');
  useEffect(() => {
    const fetchForPilot = async (pilotId) => {
      if (!pilotId) return;
      const missionsRes = await supabase
        .from('missions')
        .select('id, mission_identifier, drone_id, status, date')
        .eq('pilot_id', pilotId)
        .order('date', { ascending: false });

      const missions = missionsRes.data || [];
      setAvailableMissions(
        missions.map((m) => ({
          id: m.id,
          name: `${m.mission_identifier || m.id}${m.status ? ` (${m.status})` : ''}`,
        }))
      );

      const droneIds = [...new Set(missions.map(m => m.drone_id).filter(Boolean))];
      if (droneIds.length > 0) {
        const dronesRes = await supabase.from('drones').select('id, serial_number, model').in('id', droneIds);
        setAvailableDrones(dronesRes.data.map(d => ({ id: d.id, name: `${d.serial_number} (${d.model})` })));
      } else {
        setAvailableDrones([]);
      }
    };

    // Only run when admin selects a pilot (not for pilot user, since initial fetch handles that)
    if (selectedPilotId && user?.role !== 'pilot') {
      fetchForPilot(selectedPilotId);
    }
  }, [selectedPilotId, user]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        log_date: data.date.toISOString(),
        pilot_id: data.pilotId,
        drone_id: data.droneId,
        mission_id: data.missionId || null,
        duration_minutes: data.duration,
        incident_reported: data.incidentReported,
        incident_details: cleanMultilineText(data.notes, { max: 2000 }) || null,
      };

      const { error } = await supabase.from('flight_logs').insert([payload]);
      if (error) throw error;

      toast.success('Flight log submitted successfully');
      navigate('/flight-logs');
    } catch (error) {
      toast.error('Failed to submit flight log');
    }
  };

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card p-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/flight-logs')}
            className="p-2 bg-bg-elevated border border-border rounded hover:bg-bg-primary hover:text-accent transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Submit Flight Log</h1>
            <p className="text-sm text-text-secondary mt-1">Record post-flight metrics, weather, and incidents.</p>
          </div>
        </div>
      </div>

      <form id="flight-log-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col xl:flex-row gap-6">
        
        {/* Main Column */}
        <div className="flex-1 space-y-6">
          
          {/* Flight Details Section */}
          <div className="card p-6 border-t-4 border-t-accent">
            <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-5 pb-2 border-b border-border/50">Flight Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div className="flex flex-col">
                <label className="block font-sans text-xs text-text-secondary mb-1">Date & Time of Flight</label>
                <div className="relative w-full">
                  <Controller
                    control={control}
                    name="date"
                    render={({ field }) => (
                      <DatePicker
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                        showTimeSelect
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className={`w-full bg-bg-primary border ${errors.date ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors`}
                        wrapperClassName="w-full"
                      />
                    )}
                  />
                </div>
                {errors.date && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.date.message}</p>}
              </div>

              {/* Mission ID (Optional) */}
              <div>
                <label className="block font-sans text-xs text-text-secondary mb-1">Associated Mission (Optional)</label>
                <select
                  {...register('missionId')}
                  className="w-full bg-bg-primary border border-border text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
                >
                  <option value="">-- None --</option>
                  {availableMissions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Pilot */}
              <div>
                <label className="block font-sans text-xs text-text-secondary mb-1">Pilot in Command</label>
                <select 
                  {...register('pilotId')}
                  disabled={user?.role === 'pilot'}
                  className={`w-full bg-bg-primary border ${errors.pilotId ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-sans text-sm focus:outline-none focus:border-accent transition-colors appearance-none ${user?.role === 'pilot' ? 'opacity-80' : ''}`}
                >
                  <option value="">-- Select Pilot --</option>
                  {availablePilots.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {errors.pilotId && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.pilotId.message}</p>}
              </div>

              {/* Drone */}
              <div>
                <label className="block font-sans text-xs text-text-secondary mb-1">Aircraft</label>
                <select 
                  {...register('droneId')}
                  className={`w-full bg-bg-primary border ${errors.droneId ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-sans text-sm focus:outline-none focus:border-accent transition-colors appearance-none`}
                >
                  <option value="">-- Select Drone --</option>
                  {availableDrones.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.droneId && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.droneId.message}</p>}
              </div>

              {/* Duration */}
              <div>
                <label className="block font-sans text-xs text-text-secondary mb-1">Duration (Minutes)</label>
                <input 
                  type="number"
                  {...register('duration', { valueAsNumber: true })}
                  className={`w-full bg-bg-primary border ${errors.duration ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors`}
                />
                {errors.duration && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.duration.message}</p>}
              </div>

              {/* Max Altitude */}
              <div>
                <label className="block font-sans text-xs text-text-secondary mb-1">Max Altitude (Meters AGL)</label>
                <input 
                  type="number"
                  {...register('maxAltitude', { valueAsNumber: true })}
                  className={`w-full bg-bg-primary border ${errors.maxAltitude ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors`}
                />
                {errors.maxAltitude && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.maxAltitude.message}</p>}
              </div>

            </div>
          </div>

          {/* Notes & Incidents */}
          <div className="card p-6 border-t-4 border-t-text-muted">
             <div className="flex items-center justify-between mb-5 pb-2 border-b border-border/50">
               <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider">Remarks & Incidents</h3>
               
               <label className="flex items-center cursor-pointer">
                  <span className={`mr-3 text-sm font-semibold ${hasIncident ? 'text-status-danger' : 'text-text-muted'}`}>
                    REPORT INCIDENT
                  </span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" {...register('incidentReported')} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${hasIncident ? 'bg-status-danger' : 'bg-bg-primary border border-border'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-text-primary w-4 h-4 rounded-full transition-transform ${hasIncident ? 'transform translate-x-4 bg-white' : ''}`}></div>
                  </div>
                </label>
             </div>

             <textarea 
                {...register('notes')}
                rows="5"
                className={`w-full bg-bg-primary border ${hasIncident ? 'border-status-danger/50 focus:border-status-danger' : 'border-border focus:border-accent'} text-text-primary px-4 py-3 rounded font-sans text-sm focus:outline-none transition-colors resize-none`}
                placeholder={hasIncident ? "Describe the incident in detail (e.g., bird strike, signal loss, hard landing)..." : "General post-flight remarks..."}
              />
          </div>

        </div>

        {/* Sidebar Column */}
        <div className="w-full xl:w-96 space-y-6">
          
          {/* Weather Section */}
          <div className="card p-6 border-t-4 border-t-text-secondary">
             <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-5 pb-2 border-b border-border/50 flex items-center gap-2">
               <Cloud size={18} /> Weather Data
             </h3>

             <div className="space-y-4">
                {/* Temperature */}
                <div>
                  <label className="flex items-center gap-1 font-sans text-xs text-text-secondary mb-1">
                    <Thermometer size={14} /> Temp (Â°C)
                  </label>
                  <input 
                    type="number"
                    {...register('temperature', { valueAsNumber: true })}
                    className={`w-full bg-bg-primary border ${errors.temperature ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors`}
                  />
                  {errors.temperature && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.temperature.message}</p>}
                </div>

                {/* Wind */}
                <div>
                  <label className="flex items-center gap-1 font-sans text-xs text-text-secondary mb-1">
                    <Wind size={14} /> Wind Speed (m/s)
                  </label>
                  <input 
                    type="number"
                    {...register('windSpeed', { valueAsNumber: true })}
                    className={`w-full bg-bg-primary border ${errors.windSpeed ? 'border-status-danger' : 'border-border'} text-text-primary px-3 py-2 rounded font-data text-sm focus:outline-none focus:border-accent transition-colors`}
                  />
                  {errors.windSpeed && <p className="text-status-danger text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.windSpeed.message}</p>}
                </div>

                {/* Visibility */}
                <div>
                  <label className="flex items-center gap-1 font-sans text-xs text-text-secondary mb-1">
                    <Eye size={14} /> Visibility
                  </label>
                  <select 
                    {...register('visibility')}
                    className="w-full bg-bg-primary border border-border text-text-primary px-3 py-2 rounded font-sans text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
                  >
                    <option value="Clear">Clear</option>
                    <option value="Partly Cloudy">Partly Cloudy</option>
                    <option value="Overcast">Overcast</option>
                    <option value="Fog/Haze">Fog/Haze</option>
                    <option value="Rain">Rain</option>
                  </select>
                </div>
             </div>
          </div>

          {/* Submit Action */}
          <div className="card p-6">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-accent text-white font-heading text-lg rounded py-4 hover:bg-accent/90 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              Submit Log
            </button>
            <p className="text-center text-xs text-text-muted mt-3 font-sans">
              Submitting a log with an incident will automatically notify safety officers.
            </p>
          </div>

        </div>

      </form>
    </div>
  );
};

export default NewFlightLogPage;
