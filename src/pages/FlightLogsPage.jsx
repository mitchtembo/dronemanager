import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, PlaneTakeoff, Clock, AlertTriangle, BarChart2, Eye, Loader2, List } from 'lucide-react';
import KPICard from '../components/ui/KPICard';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { getFlightLogReview } from '../lib/flightLogReview';

const formatLogDate = (date) => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { date: '-', time: '' };
  }

  return {
    date: parsedDate.toLocaleDateString(),
    time: parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};

const FlightLogsPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFlights: 0,
    totalHours: 0,
    incidents: 0
  });
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const isPilot = user?.role === 'pilot';

  const fetchLogs = async () => {
    setIsLoading(true);
    let query = supabase
      .from('flight_logs')
      .select(`
        *,
        pilot:pilot_id(full_name),
        mission:mission_id(name, mission_identifier, type, location, status, drone:drone_id(model, serial_number))
      `)
      .order('log_date', { ascending: false });

    if (isPilot) {
      query = query.eq('pilot_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);

      const totalFlights = data?.length || 0;
      const totalMinutes = data?.reduce((acc, log) => acc + (log.duration_minutes || 0), 0) || 0;
      const incidents = data?.filter(log => log.incident_reported)?.length || 0;

      setStats({
        totalFlights,
        totalHours: Math.round(totalMinutes / 60),
        incidents
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchLogs();
  }, [user, authLoading]);

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Flight Logs</h2>
          <p className="mt-1 text-sm text-text-muted">
            {isPilot ? 'Submit and track your own mission flight logs.' : 'Review flight logs submitted by pilots across the system.'}
          </p>
        </div>
        {isPilot && (
          <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/flight-logs/new')}
            className="btn-primary flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_0_10px_rgba(59,130,246,0.3)] text-sm px-4 py-2"
          >
            <Plus size={18} />
            <span>New Flight Log</span>
          </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        <KPICard
          title="Total Flights"
          value={stats.totalFlights.toString()}
          icon={PlaneTakeoff}
          trend={{ value: 'All Time' }}
          colorClass="text-accent"
          bgClass="bg-accent/10"
        />
        <KPICard
          title="Total Hours"
          value={stats.totalHours.toString()}
          unit="h"
          icon={Clock}
          trend={{ value: 'All Time' }}
          colorClass="text-status-warning"
          bgClass="bg-status-warning/10"
        />
        <KPICard
          title="Incidents"
          value={stats.incidents.toString()}
          icon={AlertTriangle}
          trend={stats.incidents > 0 ? { value: 'Action required', isPositive: false } : undefined}
          colorClass="text-status-danger"
          bgClass="bg-status-danger/10"
        />
        <div className="card p-5 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-bg-elevated/80 transition-colors group">
          <BarChart2 className="text-accent mb-2 group-hover:scale-110 transition-transform" size={32} />
          <span className="font-sans text-xs font-semibold text-accent uppercase tracking-widest">Generate Report</span>
        </div>
      </div>

      <div className="card overflow-hidden min-w-0">
        <div className="min-w-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p>Loading flight logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <List className="mb-2 opacity-50" size={32} />
              <p>No flight logs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
              {logs.map((log) => {
                const logDate = formatLogDate(log.log_date);
                const pilotName = log.pilot?.full_name || 'Unknown Pilot';
                const pilotInitials = pilotName.substring(0, 2).toUpperCase();
                const incidentDetails = log.incident_details || 'Incident Reported';
                const review = getFlightLogReview(log);
                const missionName = log.mission?.name || log.mission?.mission_identifier || 'Unlinked flight';

                return (
                  <article
                    key={log.id}
                    className={`min-w-0 rounded border border-border bg-bg-primary/40 p-4 transition-colors hover:border-accent/40 hover:bg-bg-elevated/20 ${
                      log.incident_reported ? 'border-l-2 border-l-status-danger' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-9 h-9 shrink-0 rounded bg-bg-elevated border border-border flex items-center justify-center font-sans font-bold text-[10px] text-text-secondary">
                          {pilotInitials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-text-primary truncate">{pilotName}</h3>
                          <div className="font-data text-xs text-text-muted">
                            {logDate.date}{logDate.time ? ` - ${logDate.time}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          review.status === 'approved'
                            ? 'bg-status-success/10 text-status-success border-status-success/20'
                            : review.status === 'declined'
                              ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
                              : 'bg-status-warning/10 text-status-warning border-status-warning/20'
                        }`}>
                          {review.label}
                        </span>
                        <button
                          onClick={() => navigate(`/flight-logs/${log.id}`)}
                          className="inline-flex items-center gap-1.5 rounded border border-accent/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0 sm:col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Mission</div>
                        <div className="mt-1 text-text-primary break-words">{missionName}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Drone</div>
                        <div className="mt-1 text-text-primary font-data break-words">{log.mission?.drone?.model || 'Unknown Drone'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Mission Type</div>
                        <div className="mt-1 text-text-primary break-words">{log.mission?.type || log.mission_type || 'Unspecified'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Duration</div>
                        <div className="mt-1 font-data text-text-secondary">{log.duration_minutes ?? 0} min</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Location</div>
                        <div className="mt-1 text-text-secondary break-words">{log.mission?.location || log.departure_location || '-'}</div>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Incidents</div>
                        <div className="mt-1">
                          {!log.incident_reported ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-status-success/10 text-status-success font-sans text-[10px] uppercase font-bold border border-status-success/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
                              None
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1.5 px-2 py-1 rounded bg-status-danger/10 text-status-danger font-sans text-[10px] uppercase font-bold border border-status-danger/20">
                              <span className="w-1.5 h-1.5 mt-1 shrink-0 rounded-full bg-status-danger"></span>
                              <span className="normal-case tracking-normal leading-relaxed break-words">{incidentDetails}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-bg-elevated/50 flex items-center justify-between text-text-muted text-xs font-semibold">
          <div>
            Showing <span className="font-data text-text-primary">{logs.length}</span> logs
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightLogsPage;
