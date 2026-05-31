import { useState, useEffect, useContext } from 'react';
import { Users, Plane, AlertTriangle, FileCheck, Loader2 } from 'lucide-react';
import KPICard from '../components/ui/KPICard';
import StatusBadge from '../components/ui/StatusBadge';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';

const formatMissionDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState({
    activePilots: 0,
    activeMissions: 0,
    pendingApprovals: 0,
    criticalAlerts: 0,
    recentMissions: [],
    // pilot-specific
    assignedMissions: 0,
    completedMissions: 0,
    totalFlightMinutes: 0,
    upcomingMissions: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      
      try {
        // If user is a pilot, show pilot-specific KPIs
        if (user?.role === 'pilot') {
          const today = new Date().toISOString().split('T')[0];
          const [assignedRes, completedRes, flightLogsRes, upcomingRes] = await Promise.all([
            supabase.from('missions').select('*', { count: 'exact', head: true }).eq('pilot_id', user.id).in('status', ['Active', 'Scheduled']),
            supabase.from('missions').select('*', { count: 'exact', head: true }).eq('pilot_id', user.id).eq('status', 'Completed'),
            supabase.from('flight_logs').select('duration_minutes').eq('pilot_id', user.id),
            supabase.from('missions')
              .select(`
                id,
                mission_identifier,
                name,
                type,
                date,
                status,
                pilot:pilot_id(full_name)
              `)
              .eq('pilot_id', user.id)
              .in('status', ['Scheduled','Active'])
              .gte('date', today)
              .order('date', { ascending: true })
              .limit(5)
          ]);

          // Sum flight minutes
          const totalMinutes = (flightLogsRes.data || []).reduce((sum, r) => sum + (r.duration_minutes || 0), 0);

          setDashboardData((d) => ({
            ...d,
            assignedMissions: assignedRes.count || 0,
            completedMissions: completedRes.count || 0,
            totalFlightMinutes: totalMinutes,
            upcomingMissions: upcomingRes.data || [],
            recentMissions: upcomingRes.data || []
          }));
        } else {
          const [pilotsRes, missionsCountRes, pendingRes, recentMissionsRes] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'pilot').eq('status', 'Active'),
            supabase.from('missions').select('*', { count: 'exact', head: true }).in('status', ['Active', 'Scheduled']),
            supabase.from('missions').select('*', { count: 'exact', head: true }).eq('status', 'Scheduled'),
            supabase.from('missions')
              .select(`
                id, 
                mission_identifier,
                name, 
                type, 
                date, 
                status, 
                pilot:pilot_id(full_name)
              `)
              .order('created_at', { ascending: false })
              .limit(5)
            ,supabase.from('flight_logs').select('*', { count: 'exact', head: true }).eq('incident_reported', true)
          ]);

          setDashboardData((d) => ({
            ...d,
            activePilots: pilotsRes.count || 0,
            activeMissions: missionsCountRes.count || 0,
            pendingApprovals: pendingRes.count || 0,
            criticalAlerts: recentMissionsRes.count || 0,
            recentMissions: recentMissionsRes.data || []
          }));
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) fetchDashboardData();
  }, [user, authLoading]);

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 pb-6">
      {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {user?.role === 'pilot' ? (
              <>
                <KPICard
                  title="Assigned Missions"
                  value={dashboardData.assignedMissions.toString()}
                  icon={Plane}
                  trend="neutral"
                  trendValue="Assigned to you"
                />
                <KPICard
                  title="Completed Missions"
                  value={dashboardData.completedMissions.toString()}
                  icon={FileCheck}
                  trend="up"
                  trendValue="Completed"
                />
                <KPICard
                  title="Flight Hours"
                  value={((dashboardData.totalFlightMinutes || 0) / 60).toFixed(1)}
                  icon={Users}
                  trend="neutral"
                  trendValue="Hours flown"
                />
                <KPICard
                  title="Upcoming"
                  value={(dashboardData.upcomingMissions?.length || 0).toString()}
                  icon={AlertTriangle}
                  trend="up"
                  trendValue="Next missions"
                />
              </>
            ) : (
              <>
                <KPICard 
                  title="Active Pilots" 
                  value={dashboardData.activePilots.toString()} 
                  icon={Users} 
                  trend="up" 
                  trendValue="All time" 
                />
                <KPICard 
                  title="Active Missions" 
                  value={dashboardData.activeMissions.toString()} 
                  icon={Plane} 
                  trend="up" 
                  trendValue="Currently running/scheduled" 
                />
                <KPICard 
                  title="Pending Approvals" 
                  value={dashboardData.pendingApprovals.toString()} 
                  icon={FileCheck} 
                  isWarning={true}
                  trendValue="Action required" 
                />
                <KPICard 
                  title="Critical Alerts" 
                  value={dashboardData.criticalAlerts.toString()} 
                  icon={AlertTriangle} 
                  isDanger={true}
                  trendValue="Incident reports" 
                />
              </>
            )}
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 flex-1 min-h-0">
        {/* Recent Missions Table */}
        <div className="lg:col-span-2 card p-4 md:p-6 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
            <h2 className="text-lg font-heading font-semibold text-text-primary tracking-wide">Recent Missions</h2>
            <button className="text-sm text-accent hover:underline font-medium">View All</button>
          </div>
          <div className="flex-1 md:overflow-auto md:pr-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Loader2 className="animate-spin mb-2" size={24} />
                <p>Loading recent missions...</p>
              </div>
            ) : dashboardData.recentMissions.length === 0 ? (
              <div className="rounded border border-border bg-bg-primary p-4 text-center text-sm text-text-muted">
                No recent missions found.
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {dashboardData.recentMissions.map((mission) => (
                    <article key={mission.id} className="rounded border border-border bg-bg-primary p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-heading text-base font-semibold uppercase tracking-wide text-text-primary">
                            {mission.name || mission.mission_identifier || 'Unnamed'}
                          </h3>
                          <p className="mt-1 text-xs text-text-muted">{mission.type || 'Mission'}</p>
                        </div>
                        <StatusBadge status={mission.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-text-muted">Pilot</div>
                          <div className="mt-1 text-text-secondary">{mission.pilot?.full_name || (user?.role === 'pilot' ? user.fullName : 'Unassigned')}</div>
                        </div>
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-text-muted">Date</div>
                          <div className="mt-1 font-data text-text-secondary">{formatMissionDate(mission.date)}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="sticky top-0 bg-bg-primary/90 backdrop-blur z-10">
                    <tr className="border-b border-border text-text-muted font-heading uppercase tracking-wider text-xs">
                      <th className="pb-3 font-semibold">Mission Name</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Pilot</th>
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dashboardData.recentMissions.map((mission) => (
                      <tr key={mission.id} className="hover:bg-bg-elevated/30 transition-colors">
                        <td className="py-3 font-data text-accent">{mission.name || mission.mission_identifier || 'Unnamed'}</td>
                        <td className="py-3 text-text-primary">{mission.type}</td>
                        <td className="py-3 text-text-secondary">{mission.pilot?.full_name || (user?.role === 'pilot' ? user.fullName : 'Unassigned')}</td>
                        <td className="py-3 text-text-secondary">{formatMissionDate(mission.date)}</td>
                        <td className="py-3"><StatusBadge status={mission.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="card p-4 md:p-6 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
            <h2 className="text-lg font-heading font-semibold text-text-primary tracking-wide">Operational Notices</h2>
          </div>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {user?.role === 'pilot' ? (
              <div className="p-4 rounded-lg border border-border bg-bg-primary">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-warning" />
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-1">Assigned missions</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      You currently have {dashboardData.assignedMissions} assigned mission(s) and {dashboardData.upcomingMissions.length} upcoming.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-lg border border-border bg-bg-primary">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-warning" />
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-1">Pending approvals</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {dashboardData.pendingApprovals} mission(s) are waiting for review or action.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-bg-primary">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-danger" />
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-1">Incident reports</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {dashboardData.criticalAlerts} flight log(s) contain incident reports.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            <button className="w-full py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded transition-colors mt-2">
              View All Notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
