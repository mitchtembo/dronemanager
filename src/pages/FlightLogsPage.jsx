import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, PlaneTakeoff, Clock, AlertTriangle, BarChart2, Eye, Loader2, List } from 'lucide-react';
import KPICard from '../components/ui/KPICard';
import PaginationControls from '../components/ui/PaginationControls';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { getFlightLogReview } from '../lib/flightLogReview';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const PAGE_SIZE_DEFAULT = 25;

const FlightLogsPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFlights: 0,
    totalHours: 0,
    incidents: 0
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [totalCount, setTotalCount] = useState(0);
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const isPilot = user?.role === 'pilot';

  const generatePDFReport = () => {
    const doc = new jsPDF();

    // Add Title
    doc.setFontSize(20);
    doc.text('Flight Logs Report', 14, 22);

    // Add Summary Stats
    doc.setFontSize(12);
    doc.text(`Total Flights: ${stats.totalFlights}`, 14, 32);
    doc.text(`Total Hours: ${stats.totalHours}`, 14, 38);
    doc.text(`Incidents: ${stats.incidents}`, 14, 44);

    // Prepare Table Data
    const tableColumn = ["Date", "Pilot", "Mission", "Drone", "Duration (min)", "Status"];
    const tableRows = [];

    logs.forEach(log => {
      const logDate = formatLogDate(log.log_date);
      const pilotName = log.pilot?.full_name || 'Unknown Pilot';
      const missionName = log.mission?.name || log.mission?.mission_identifier || 'Unlinked flight';
      const droneModel = log.mission?.drone?.model || 'Unknown Drone';
      const review = getFlightLogReview(log);

      const logData = [
        `${logDate.date} ${logDate.time}`,
        pilotName,
        missionName,
        droneModel,
        log.duration_minutes || 0,
        review.label
      ];
      tableRows.push(logData);
    });

    // Add Table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    // Save the PDF
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`flight_logs_report_${dateStr}.pdf`);
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('flight_logs')
      .select(`
        *,
        pilot:pilot_id(full_name),
        mission:mission_id(name, mission_identifier, type, location, status, drone:drone_id(model, serial_number))
      `, { count: 'exact' })
      .order('log_date', { ascending: false })
      .range(from, to);

    if (isPilot) {
      query = query.eq('pilot_id', user.id);
    }

    const statsRequests = [
      supabase.from('flight_logs').select('id', { count: 'exact', head: true }),
      supabase.from('flight_logs').select('id', { count: 'exact', head: true }).eq('incident_reported', true),
      supabase.from('flight_logs').select('duration_minutes'),
    ];

    if (isPilot) {
      statsRequests[0] = statsRequests[0].eq('pilot_id', user.id);
      statsRequests[1] = statsRequests[1].eq('pilot_id', user.id);
      statsRequests[2] = statsRequests[2].eq('pilot_id', user.id);
    }

    const [{ data, error, count }, totalResponse, incidentResponse, durationResponse] = await Promise.all([
      query,
      ...statsRequests,
    ]);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);
      setTotalCount(count || 0);

      const totalMinutes = durationResponse.data?.reduce((acc, log) => acc + (log.duration_minutes || 0), 0) || 0;

      setStats({
        totalFlights: totalResponse.count || 0,
        totalHours: Math.round(totalMinutes / 60),
        incidents: incidentResponse.count || 0
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchLogs();
  }, [user, authLoading, page, pageSize]);

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
        <div
          onClick={generatePDFReport}
          className="card p-5 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-bg-elevated/80 transition-colors group"
        >
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                <thead className="border-b border-border bg-bg-elevated/50 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="w-[11%] px-4 py-3 font-semibold">Date</th>
                    <th className="w-[14%] px-4 py-3 font-semibold">Pilot</th>
                    <th className="w-[16%] px-4 py-3 font-semibold">Mission</th>
                    <th className="w-[13%] px-4 py-3 font-semibold">Drone</th>
                    <th className="w-[11%] px-4 py-3 font-semibold">Type</th>
                    <th className="w-[8%] px-4 py-3 font-semibold">Duration</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Review</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Incident</th>
                    <th className="w-[7%] px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.map((log, index) => {
                    const logDate = formatLogDate(log.log_date);
                    const pilotName = log.pilot?.full_name || 'Unknown Pilot';
                    const incidentDetails = log.incident_details || 'Incident Reported';
                    const review = getFlightLogReview(log);
                    const missionName = log.mission?.name || log.mission?.mission_identifier || 'Unlinked flight';

                    return (
                      <tr key={log.id} className={`transition-colors hover:bg-bg-elevated/40 ${index % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                        <td className="px-4 py-4">
                          <div className="font-data text-text-primary">{logDate.date}</div>
                          <div className="font-data text-xs text-text-muted">{logDate.time}</div>
                        </td>
                        <td className="truncate px-4 py-4 font-semibold text-text-primary">{pilotName}</td>
                        <td className="truncate px-4 py-4 text-text-primary">{missionName}</td>
                        <td className="truncate px-4 py-4 font-data text-text-secondary">{log.mission?.drone?.model || 'Unknown Drone'}</td>
                        <td className="truncate px-4 py-4 text-text-secondary">{log.mission?.type || log.mission_type || 'Unspecified'}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-data text-accent">{log.duration_minutes ?? 0} min</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            review.status === 'approved'
                              ? 'border-status-success/20 bg-status-success/10 text-status-success'
                              : review.status === 'declined'
                                ? 'border-status-danger/20 bg-status-danger/10 text-status-danger'
                                : 'border-status-warning/20 bg-status-warning/10 text-status-warning'
                          }`}>
                            {review.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {!log.incident_reported ? (
                            <span className="inline-flex rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-success">
                              None
                            </span>
                          ) : (
                            <span className="block truncate text-xs text-status-danger" title={incidentDetails}>{incidentDetails}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <button
                              onClick={() => navigate(`/flight-logs/${log.id}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-accent/30 text-accent transition-colors hover:bg-accent/10"
                              title="View flight log"
                              aria-label={`View flight log for ${missionName}`}
                            >
                              <Eye size={15} />
                            </button>
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
            itemLabel="logs"
          />
        )}
      </div>
    </div>
  );
};

export default FlightLogsPage;
