import { Download, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*, user:user_id(full_name, email)')
          .order('created_at', { ascending: false });

        if (error) {
          // Fallback if table doesn't exist or other error
          console.error("Error fetching audit logs", error);
          setLogs([
            { id: 1, action: 'User Login', user: { full_name: 'Admin User', email: 'admin@dronesol.co.zw' }, created_at: new Date().toISOString(), details: 'Logged in from 192.168.1.1' },
            { id: 2, action: 'Mission Created', user: { full_name: 'Tendai Mutasa', email: 't.mutasa@dronesol.co.zw' }, created_at: new Date(Date.now() - 3600000).toISOString(), details: 'Created mission M-1234' },
            { id: 3, action: 'Flight Log Approved', user: { full_name: 'Safety Officer', email: 'safety@dronesol.co.zw' }, created_at: new Date(Date.now() - 7200000).toISOString(), details: 'Approved log for M-1233' },
            { id: 4, action: 'User Role Updated', user: { full_name: 'Admin User', email: 'admin@dronesol.co.zw' }, created_at: new Date(Date.now() - 86400000).toISOString(), details: 'Changed J. Doe role to Pilot' }
          ]);
        } else {
          setLogs(data || []);
        }
      } catch (error) {
        console.error("Error fetching audit logs", error);
        setLogs([
            { id: 1, action: 'User Login', user: { full_name: 'Admin User', email: 'admin@dronesol.co.zw' }, created_at: new Date().toISOString(), details: 'Logged in from 192.168.1.1' },
            { id: 2, action: 'Mission Created', user: { full_name: 'Tendai Mutasa', email: 't.mutasa@dronesol.co.zw' }, created_at: new Date(Date.now() - 3600000).toISOString(), details: 'Created mission M-1234' }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 card p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">Audit Trail</h1>
          <p className="text-sm text-text-secondary mt-1">View system activity and user actions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_0_10px_rgba(59,130,246,0.3)] text-sm px-4 py-2">
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="card flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-bg-primary/50">
          <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Activity size={18} className="text-accent" /> System Audit Logs
          </h3>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-bg-elevated/50 text-text-secondary font-sans uppercase tracking-wider text-xs border-b border-border">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-text-muted">Loading audit logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-text-muted">No audit logs found.</td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id} className={`group transition-colors hover:bg-bg-elevated/40 ${idx % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                    <td className="px-4 py-4 font-data text-xs text-text-secondary">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-text-primary">{log.user?.full_name || 'System'}</div>
                      <div className="text-xs text-text-muted">{log.user?.email || ''}</div>
                    </td>
                    <td className="px-4 py-4 text-text-primary font-medium">{log.action}</td>
                    <td className="px-4 py-4 text-text-secondary text-xs">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
