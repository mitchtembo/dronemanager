import { Shield, UserPlus, MoreVertical, Key, Mail, CheckCircle, XCircle } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

const mockUsers = [
  { id: '1', name: 'Admin User', email: 'admin@dronesol.co.zw', role: 'System Administrator', status: 'Active', lastLogin: '2023-10-27 08:30' },
  { id: '2', name: 'Tendai Mutasa', email: 't.mutasa@dronesol.co.zw', role: 'Operations Manager', status: 'Active', lastLogin: '2023-10-27 07:15' },
  { id: '3', name: 'Safety Officer', email: 'safety@dronesol.co.zw', role: 'Safety Compliance', status: 'Active', lastLogin: '2023-10-26 16:45' },
  { id: '4', name: 'J. Doe', email: 'j.doe@dronesol.co.zw', role: 'Pilot', status: 'Inactive', lastLogin: '2023-09-15 10:00' },
];

const UserManagementPage = () => {
  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 card p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide">User Management</h1>
          <p className="text-sm text-text-secondary mt-1">Manage system access, roles, and security permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_0_10px_rgba(59,130,246,0.3)] text-sm px-4 py-2">
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: User Table */}
        <div className="xl:col-span-2 card flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-bg-primary/50">
            <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Shield size={18} className="text-accent" /> System Users
            </h3>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-bg-elevated/50 text-text-secondary font-sans uppercase tracking-wider text-xs border-b border-border">
                  <th className="px-4 py-3 font-semibold">User Details</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {mockUsers.map((user, idx) => (
                  <tr key={user.id} className={`group transition-colors hover:bg-bg-elevated/40 ${idx % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-heading font-bold text-sm border border-accent/30">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary">{user.name}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                            <Mail size={10} /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">{user.role}</td>
                    <td className="px-4 py-4">
                      {user.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-status-success/10 text-status-success font-sans text-[10px] uppercase font-bold border border-status-success/20">
                           <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-text-muted/10 text-text-muted font-sans text-[10px] uppercase font-bold border border-border">
                           <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-data text-text-secondary text-xs">{user.lastLogin}</td>
                    <td className="px-4 py-4 text-right">
                      <button className="text-text-muted hover:text-accent transition-colors p-1.5 rounded hover:bg-bg-elevated">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Roles & Security Summary */}
        <div className="space-y-6 flex flex-col min-h-0 overflow-y-auto pr-2">
          <div className="card p-6 border-t-4 border-t-accent shrink-0">
            <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-4 pb-2 border-b border-border/50 flex items-center gap-2">
              <Key size={18} /> Role Definitions
            </h3>
            
            <div className="space-y-4">
              <div className="bg-bg-primary p-3 rounded border border-border">
                <h4 className="font-semibold text-sm text-text-primary mb-1">System Administrator</h4>
                <p className="text-xs text-text-secondary">Full access to all system configurations, user management, and destructive actions.</p>
              </div>
              <div className="bg-bg-primary p-3 rounded border border-border">
                <h4 className="font-semibold text-sm text-text-primary mb-1">Operations Manager</h4>
                <p className="text-xs text-text-secondary">Can schedule missions, assign drones, and view all operational reports. Cannot delete records.</p>
              </div>
              <div className="bg-bg-primary p-3 rounded border border-border">
                <h4 className="font-semibold text-sm text-text-primary mb-1">Safety Compliance</h4>
                <p className="text-xs text-text-secondary">Read-only access to most records. Can flag drones for maintenance and suspend pilots.</p>
              </div>
              <div className="bg-bg-primary p-3 rounded border border-border">
                <h4 className="font-semibold text-sm text-text-primary mb-1">Pilot</h4>
                <p className="text-xs text-text-secondary">Can only view their own assigned missions and submit flight logs for themselves.</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-4 pb-2 border-b border-border/50 text-status-warning">
              Security Alerts
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1.5 shrink-0"></span>
                <span>2 Users have not enabled Two-Factor Authentication (2FA).</span>
              </li>
              <li className="flex items-start gap-2 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1.5 shrink-0"></span>
                <span>1 Pilot account inactive for over 30 days. Consider suspending access.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserManagementPage;
