export const READY_STATUSES = ['Ready', 'Assigned', 'In Mission', 'Needs Maintenance', 'Grounded', 'Decommissioned'];

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const parseNumber = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const isPastDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

export const getHoursSinceService = (drone) => {
  const flightHours = parseNumber(drone?.flight_hours, 0) || 0;
  const lastServiceHours = parseNumber(drone?.last_service_hours, 0) || 0;
  return Math.max(0, flightHours - lastServiceHours);
};

export const isMaintenanceDue = (drone) => {
  const interval = parseNumber(drone?.maintenance_interval_hours, 25) || 25;
  return getHoursSinceService(drone) >= interval || isPastDate(drone?.next_maintenance_date);
};

export const getServiceProgress = (drone) => {
  const interval = parseNumber(drone?.maintenance_interval_hours, 25) || 25;
  if (interval <= 0) return 100;
  return Math.min(100, Math.round((getHoursSinceService(drone) / interval) * 100));
};

export const getDroneReadiness = (drone) => {
  if (!drone) return 'Unknown';
  if (drone.status === 'Decommissioned') return 'Decommissioned';
  if (drone.status === 'Grounded') return 'Grounded';
  if (drone.status === 'Maintenance') return 'Needs Maintenance';
  if (isMaintenanceDue(drone)) return 'Needs Maintenance';
  return drone.readiness_status || 'Ready';
};

export const isDroneAssignable = (drone) => (
  drone?.status === 'Operational' && getDroneReadiness(drone) === 'Ready'
);

export const getReadinessStyles = (readiness) => {
  switch ((readiness || '').toLowerCase()) {
    case 'ready':
      return 'bg-status-success/10 text-status-success border-status-success/20';
    case 'assigned':
    case 'in mission':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'needs maintenance':
      return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    case 'grounded':
      return 'bg-status-danger/10 text-status-danger border-status-danger/20';
    case 'decommissioned':
      return 'bg-text-muted/10 text-text-muted border-text-muted/20';
    default:
      return 'bg-bg-elevated text-text-secondary border-border';
  }
};
