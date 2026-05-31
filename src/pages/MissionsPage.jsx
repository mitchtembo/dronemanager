import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Wifi, Camera, List, PlusSquare, Loader2, Eye, Pencil, XCircle } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import MissionFormModal from '../components/missions/MissionFormModal';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { ACTIVE_MISSION_STATUS, getMissionStatusLabel } from '../lib/missionStatus';
import { isMaintenanceDue } from '../lib/droneLifecycle';
import { getPilotRestingReadiness } from '../lib/pilotLifecycle';

const getMissionIcon = (type) => {
  if (type === 'Inspection') return Wifi;
  if (type === 'Search & Rescue') return Camera;
  return Grid;
};

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

const MissionsPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missions, setMissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editMission, setEditMission] = useState(null);
  const { user, isLoading: authLoading } = useContext(AuthContext);

  const fetchMissions = async () => {
    setIsLoading(true);
    let query = supabase
      .from('missions')
      .select(`
        *,
        pilot:pilot_id(full_name, status, readiness_status, licence_expiry, medical_expiry, next_training_date, next_currency_check),
        drone:drone_id(model, serial_number, status, readiness_status, next_maintenance_date, flight_hours, maintenance_interval_hours, last_service_hours)
      `)
      .order('created_at', { ascending: false });

    if (user?.role === 'pilot') {
      query = query.eq('pilot_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching missions:', error);
    } else {
      setMissions(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchMissions();
  }, [user, authLoading]);

  const handleCancelMission = async (missionId) => {
    const mission = missions.find((item) => item.id === missionId);
    const { error } = await supabase
      .from('missions')
      .update({ status: 'Cancelled' })
      .eq('id', missionId);
    if (!error) {
      if (mission?.drone_id) {
        const serviceDue = isMaintenanceDue(mission.drone);
        await supabase
          .from('drones')
          .update({
            status: serviceDue ? 'Maintenance' : 'Operational',
            readiness_status: serviceDue ? 'Needs Maintenance' : 'Ready',
          })
          .eq('id', mission.drone_id);
      }
      if (mission?.pilot_id) {
        await supabase
          .from('profiles')
          .update({ readiness_status: getPilotRestingReadiness(mission.pilot) })
          .eq('id', mission.pilot_id);
      }
      fetchMissions();
    }
  };

  const filteredMissions = missions.filter((m) => {
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    const matchesSearch =
      (m.name || m.mission_identifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.pilot?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Missions</h1>
        </div>
        <div className="flex items-center gap-4">
          {user?.role !== 'pilot' && (
            <button
              onClick={() => { setEditMission(null); setIsModalOpen(true); }}
              className="btn-primary flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_0_15px_rgba(59,130,246,0.3)] text-sm px-4 py-2"
            >
              <PlusSquare size={18} />
              <span>Create Mission</span>
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search missions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent w-full sm:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent w-full sm:w-48"
        >
          <option value="All">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value={ACTIVE_MISSION_STATUS}>In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden min-w-0">
        <div className="min-w-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p>Loading missions...</p>
            </div>
          ) : missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <List className="mb-2 opacity-50" size={32} />
              <p>No missions found.</p>
            </div>
          ) : filteredMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <List className="mb-2 opacity-50" size={32} />
              <p>No missions match the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
              {filteredMissions.map((mission) => {
                const Icon = getMissionIcon(mission.type);
                const canManage = user?.role !== 'pilot';
                const canCancel = canManage && mission.status !== 'Cancelled' && mission.status !== 'Completed';
                const missionName = mission.name || mission.mission_identifier || 'Unnamed Mission';
                const droneLabel = mission.drone?.model
                  ? `${mission.drone.model}${mission.drone?.serial_number ? ` (${mission.drone.serial_number})` : ''}`
                  : 'Unassigned';

                return (
                  <article
                    key={mission.id}
                    className="min-w-0 rounded border border-border bg-bg-primary/40 p-4 transition-colors hover:border-accent/40 hover:bg-bg-elevated/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <Icon size={20} className="text-accent" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate font-heading text-base font-bold text-text-primary uppercase tracking-wide">
                            {missionName}
                          </h2>
                          <p className="mt-0.5 truncate font-data text-xs text-text-muted">
                            {mission.mission_identifier || mission.type || 'Mission'}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={getMissionStatusLabel(mission.status)} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Type</div>
                        <div className="mt-1 text-text-primary break-words">{mission.type || 'Unspecified'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Pilot</div>
                        <div className="mt-1 text-text-primary break-words">{mission.pilot?.full_name || 'Unassigned'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Drone</div>
                        <div className="mt-1 font-data text-text-secondary break-words">{droneLabel}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Date</div>
                        <div className="mt-1 font-data text-text-secondary">{formatDate(mission.date)}</div>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Location</div>
                        <div className="mt-1 text-text-secondary break-words">{mission.location || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
                      <button
                        onClick={() => navigate(`/missions/${mission.id}`)}
                        className="inline-flex items-center gap-1.5 rounded border border-accent/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Eye size={15} />
                        View
                      </button>
                      {canManage && (
                        <button
                          onClick={() => { setEditMission(mission); setIsModalOpen(true); }}
                          className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:border-accent/40 hover:text-text-primary transition-colors"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancelMission(mission.id)}
                          className="inline-flex items-center gap-1.5 rounded border border-status-danger/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-status-danger hover:bg-status-danger/10 transition-colors"
                        >
                          <XCircle size={15} />
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-bg-primary/50 flex items-center justify-between text-text-muted text-xs font-semibold">
          <span>Showing <span className="font-data text-text-primary">{filteredMissions.length}</span> of {missions.length} missions</span>
        </div>
      </div>

      <MissionFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditMission(null); }}
        onSave={fetchMissions}
        mission={editMission}
      />
    </div>
  );
};

export default MissionsPage;
