import clsx from 'clsx';
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, trend, trendValue, isWarning, isDanger }) => {
  return (
    <div className={clsx(
      "card p-3 md:p-5 relative overflow-hidden group",
      isWarning && "border-l-4 border-l-status-warning",
      isDanger && "border-l-4 border-l-status-danger"
    )}>
      <div className="flex justify-between items-start gap-2 mb-3 md:mb-4">
        <div className="min-w-0">
          <h3 className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wide md:tracking-wider mb-1">{title}</h3>
          <p className="font-data text-2xl md:text-3xl font-bold text-text-primary">{value}</p>
        </div>
        <div className={clsx(
          "w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center transition-colors shrink-0",
          isWarning ? "bg-status-warning/10 text-status-warning" :
          isDanger ? "bg-status-danger/10 text-status-danger" :
          "bg-bg-elevated text-accent group-hover:bg-accent group-hover:text-white"
        )}>
          <Icon size={20} />
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 md:gap-2 mt-3 md:mt-4 text-[10px] md:text-xs font-medium">
        {trend === 'up' && <ArrowUpRight size={14} className="text-status-success" />}
        {trend === 'down' && <ArrowDownRight size={14} className="text-status-danger" />}
        {isWarning && <AlertTriangle size={14} className="text-status-warning" />}
        
        <span className={clsx(
          trend === 'up' && "text-status-success",
          trend === 'down' && "text-status-danger",
          isWarning && "text-status-warning",
          isDanger && "text-status-danger",
          !trend && !isWarning && !isDanger && "text-text-muted"
        )}>
          {trendValue}
        </span>
      </div>
      
      {/* Subtle background glow effect on hover */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors pointer-events-none"></div>
    </div>
  );
};

export default KPICard;
