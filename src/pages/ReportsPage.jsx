import { BarChart3, Download, Filter, FileText, Calendar, PieChart, TrendingUp } from 'lucide-react';
import { useEffect, useState, useContext } from 'react';
import KPICard from '../components/ui/KPICard';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';

const ReportsPage = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalFlightHours: 0,
    incidentRate: 0,
    complianceScore: 0,
    totalLogs: 0,
    approvedLogs: 0,
    incidentLogs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReportStats = async () => {
      setIsLoading(true);
      const [logsRes, approvedRes, incidentsRes] = await Promise.all([
        supabase.from('flight_logs').select('duration_minutes, incident_reported'),
        supabase.from('flight_logs').select('*', { count: 'exact', head: true }).not('approved_by', 'is', null),
        supabase.from('flight_logs').select('*', { count: 'exact', head: true }).eq('incident_reported', true),
      ]);

      const logs = logsRes.data || [];
      const totalFlightMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
      const totalLogs = logs.length;
      const incidentLogs = incidentsRes.count || 0;
      const approvedLogs = approvedRes.count || 0;
      const incidentRate = totalLogs > 0 ? (incidentLogs / totalLogs) * 100 : 0;
      const complianceScore = totalLogs > 0 ? Math.max(0, Math.min(100, Math.round((approvedLogs / totalLogs) * 100))) : 0;

      setStats({
        totalFlightHours: totalFlightMinutes / 60,
        incidentRate,
        complianceScore,
        totalLogs,
        approvedLogs,
        incidentLogs,
      });
      setIsLoading(false);
    };

    fetchReportStats();
  }, []);

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 card p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Compliance & Reports</h1>
          <p className="text-sm text-text-secondary mt-1">Generate analytics and compliance data for CAAZ audits.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_0_10px_rgba(59,130,246,0.3)] text-sm px-4 py-2">
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-text-muted">
          <Filter size={18} />
          <span className="font-sans text-sm font-semibold uppercase">Filters:</span>
        </div>
        
        <div className="flex items-center gap-2 bg-bg-primary border border-border rounded px-3 py-1.5">
          <Calendar size={16} className="text-text-muted" />
          <select className="bg-transparent text-text-primary text-sm focus:outline-none appearance-none">
            <option>Last 30 Days</option>
            <option>This Quarter</option>
            <option>Year to Date</option>
            <option>Custom Range...</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-bg-primary border border-border rounded px-3 py-1.5">
          <select className="bg-transparent text-text-primary text-sm focus:outline-none appearance-none">
            <option>All Pilots</option>
            <option>Active Only</option>
            <option>Suspended</option>
          </select>
        </div>

        <button className="text-accent hover:text-accent/80 text-sm font-semibold transition-colors ml-auto">
          Clear Filters
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="Total Flight Hours" 
          value={stats.totalFlightHours.toFixed(1)} 
          unit="hrs"
          icon={TrendingUp} 
          trend={{ value: `${stats.totalLogs} logs`, isPositive: true }}
          colorClass="text-accent"
          bgClass="bg-accent/10"
        />
        <KPICard 
          title="Incident Rate" 
          value={stats.incidentRate.toFixed(1)}
          unit="%"
          icon={PieChart} 
          trend={{ value: `${stats.incidentLogs} incident logs`, isPositive: false }}
          colorClass="text-status-warning"
          bgClass="bg-status-warning/10"
        />
        <KPICard 
          title="Compliance Score" 
          value={stats.complianceScore.toString()} 
          unit="/100"
          icon={BarChart3} 
          trend={{ value: `${stats.approvedLogs} approved logs`, isPositive: true }}
          colorClass="text-status-success"
          bgClass="bg-status-success/10"
        />
      </div>

      {/* Live Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 h-80 flex flex-col">
          <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-4 border-b border-border/50 pb-2">
            Report Snapshot
          </h3>
          <div className="flex-1 flex flex-col justify-center gap-4 border border-dashed border-border rounded bg-bg-primary/50 p-5">
            {isLoading ? (
              <p className="text-text-muted font-sans text-sm">Loading live report data...</p>
            ) : (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Workspace</p>
                  <p className="text-text-primary font-semibold">{user?.role === 'pilot' ? 'Pilot view' : 'Admin / Manager view'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Total logs</p>
                  <p className="text-text-primary font-semibold">{stats.totalLogs}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Approved logs</p>
                  <p className="text-text-primary font-semibold">{stats.approvedLogs}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card p-6 h-80 flex flex-col">
          <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-4 border-b border-border/50 pb-2">
            Incidents & Review
          </h3>
          <div className="flex-1 flex flex-col justify-center gap-4 border border-dashed border-border rounded bg-bg-primary/50 p-5">
            {isLoading ? (
              <p className="text-text-muted font-sans text-sm">Loading incident summary...</p>
            ) : (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Incident rate</p>
                  <p className="text-text-primary font-semibold">{stats.incidentRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Incident logs</p>
                  <p className="text-text-primary font-semibold">{stats.incidentLogs}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Compliance score</p>
                  <p className="text-text-primary font-semibold">{stats.complianceScore}/100</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Generated Reports Table */}
      <div className="card flex flex-col">
        <div className="p-4 border-b border-border">
           <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider">Recent Saved Reports</h3>
        </div>
        <div className="p-6 text-sm text-text-muted">
          No saved reports are stored yet. Use Export CSV to generate a live report from the current flight log data.
        </div>
      </div>

    </div>
  );
};

export default ReportsPage;
