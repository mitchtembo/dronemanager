import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Wifi, Camera, List, PlusSquare, Loader2, Eye, Pencil, XCircle } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import PaginationControls from '../components/ui/PaginationControls';
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

const PAGE_SIZE_DEFAULT = 25;

const applyMissionSearch = (request, text) => {
  const value = text.trim().replace(/,/g, ' ');
  if (!value) return request;

  return request.or([
    `name.ilike.%${value}%`,
    `mission_identifier.ilike.%${value}%`,
    `location.ilike.%${value}%`,
    `type.ilike.%${value}%`,
  ].join(','));
};

const MissionsPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missions, setMissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editMission, setEditMission] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [totalCount, setTotalCount] = useState(0);
  const { user, isLoading: authLoading } = useContext(AuthContext);

  const fetchMissions = async () => {
    setIsLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('missions')
      .select(`
        *,
        pilot:pilot_id(full_name, status, readiness_status, licence_expiry, medical_expiry, next_training_date, next_currency_check),
        drone:drone_id(model, serial_number, status, readiness_status, next_maintenance_date, flight_hours, maintenance_interval_hours, last_service_hours)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (user?.role === 'pilot') {
      query = query.eq('pilot_id', user.id);
    }
    if (statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }
    query = applyMissionSearch(query, searchTerm);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching missions:', error);
    } else {
      setMissions(data || []);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchMissions();
  }, [user, authLoading, page, pageSize, searchTerm, statusFilter]);

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
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent w-full sm:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
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
              <p>No missions match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                <thead className="border-b border-border bg-bg-elevated/50 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="w-[21%] px-4 py-3 font-semibold">Mission</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Status</th>
                    <th className="w-[11%] px-4 py-3 font-semibold">Type</th>
                    <th className="w-[13%] px-4 py-3 font-semibold">Pilot</th>
                    <th className="w-[13%] px-4 py-3 font-semibold">Drone</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Date</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Location</th>
                    <th className="w-[12%] px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {missions.map((mission, index) => {
                    const Icon = getMissionIcon(mission.type);
                    const canManage = user?.role !== 'pilot';
                    const canCancel = canManage && mission.status !== 'Cancelled' && mission.status !== 'Completed';
                    const missionName = mission.name || mission.mission_identifier || 'Unnamed Mission';
                    const droneLabel = mission.drone?.model
                      ? `${mission.drone.model}${mission.drone?.serial_number ? ` (${mission.drone.serial_number})` : ''}`
                      : 'Unassigned';

                    return (
                      <tr key={mission.id} className={`transition-colors hover:bg-bg-elevated/40 ${index % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-accent/20 bg-accent/10">
                              <Icon size={18} className="text-accent" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-text-primary">{missionName}</div>
                              <div className="font-data text-xs text-text-muted">{mission.mission_identifier || 'No identifier'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={getMissionStatusLabel(mission.status)} /></td>
                        <td className="truncate px-4 py-4 text-text-secondary">{mission.type || 'Unspecified'}</td>
                        <td className="truncate px-4 py-4 text-text-primary">{mission.pilot?.full_name || 'Unassigned'}</td>
                        <td className="truncate px-4 py-4 font-data text-text-secondary">{droneLabel}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-data text-text-secondary">{formatDate(mission.date)}</td>
                        <td className="truncate px-4 py-4 text-text-secondary">{mission.location || '-'}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => navigate(`/missions/${mission.id}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-accent/30 text-accent transition-colors hover:bg-accent/10"
                              title="View mission"
                              aria-label={`View ${missionName}`}
                            >
                              <Eye size={15} />
                            </button>
                            {canManage && (
                              <button
                                onClick={() => { setEditMission(mission); setIsModalOpen(true); }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
                                title="Edit mission"
                                aria-label={`Edit ${missionName}`}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => handleCancelMission(mission.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-status-danger/30 text-status-danger transition-colors hover:bg-status-danger/10"
                                title="Cancel mission"
                                aria-label={`Cancel ${missionName}`}
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
            itemLabel="missions"
          />
        )}
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
