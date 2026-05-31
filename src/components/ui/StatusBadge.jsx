import clsx from 'clsx';

const StatusBadge = ({ status }) => {
  const normalizedStatus = status?.toLowerCase();

  const getStatusStyles = () => {
    switch (normalizedStatus) {
      case 'active':
      case 'valid':
      case 'completed':
      case 'approved':
      case 'operational':
      case 'ready':
        return 'bg-status-success/10 text-status-success border-status-success/20';
      case 'suspended':
      case 'expiring':
      case 'maintenance':
      case 'scheduled':
      case 'in progress':
      case 'pending review':
      case 'assigned':
      case 'in mission':
      case 'needs maintenance':
      case 'needs renewal':
        return normalizedStatus === 'scheduled' 
          ? 'bg-accent/10 text-accent border-accent/20'
          : 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'inactive':
      case 'decommissioned':
        return 'bg-text-muted/10 text-text-muted border-text-muted/20';
      case 'expired':
      case 'cancelled':
      case 'declined':
      case 'grounded':
        return 'bg-status-danger/10 text-status-danger border-status-danger/20';
      default:
        return 'bg-bg-elevated text-text-secondary border-border';
    }
  };

  const getDotColor = () => {
    switch (normalizedStatus) {
      case 'active':
      case 'valid':
      case 'completed':
      case 'approved':
      case 'operational':
      case 'ready':
        return 'bg-status-success';
      case 'suspended':
      case 'expiring':
      case 'maintenance':
      case 'in progress':
      case 'pending review':
      case 'assigned':
      case 'in mission':
      case 'needs maintenance':
      case 'needs renewal':
        return 'bg-status-warning';
      case 'scheduled':
        return 'bg-accent';
      case 'inactive':
      case 'decommissioned':
        return 'bg-text-muted';
      case 'expired':
      case 'cancelled':
      case 'declined':
      case 'grounded':
        return 'bg-status-danger';
      default:
        return 'bg-border';
    }
  };

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      getStatusStyles()
    )}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", getDotColor())}></span>
      {status}
    </span>
  );
};

export default StatusBadge;
