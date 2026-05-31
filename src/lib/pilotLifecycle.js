export const PILOT_READINESS_STATUSES = ['Ready', 'Assigned', 'In Mission', 'Needs Renewal', 'Grounded', 'Inactive'];

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

export const parseNumber = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const getDaysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export const getPilotCertificationState = (pilot, warningDays = 30) => {
  const licenceDays = getDaysUntil(pilot?.licence_expiry);
  const medicalDays = getDaysUntil(pilot?.medical_expiry);
  const knownDays = [licenceDays, medicalDays].filter((value) => value !== null);

  if (knownDays.some((value) => value < 0)) return 'expired';
  if (knownDays.some((value) => value <= warningDays)) return 'expiring';
  if (knownDays.length === 0) return 'missing';
  return 'valid';
};

export const getPilotCurrencyState = (pilot, warningDays = 30) => {
  const trainingDays = getDaysUntil(pilot?.next_training_date);
  const currencyDays = getDaysUntil(pilot?.next_currency_check);
  const knownDays = [trainingDays, currencyDays].filter((value) => value !== null);

  if (knownDays.some((value) => value < 0)) return 'due';
  if (knownDays.some((value) => value <= warningDays)) return 'upcoming';
  if (knownDays.length === 0) return 'unknown';
  return 'current';
};

export const getPilotRestingReadiness = (pilot) => {
  if (!pilot) return 'Ready';
  if (pilot.status === 'Inactive') return 'Inactive';
  if (pilot.status === 'Suspended') return 'Grounded';
  if (getPilotCertificationState(pilot, 0) === 'expired') return 'Needs Renewal';
  if (getPilotCurrencyState(pilot, 0) === 'due') return 'Needs Renewal';
  if (pilot.readiness_status === 'Grounded') return 'Grounded';
  if (pilot.readiness_status === 'Inactive') return 'Inactive';
  return 'Ready';
};

export const getPilotReadiness = (pilot, activeMission = null) => {
  if (!pilot) return 'Unknown';
  if (pilot.status === 'Inactive') return 'Inactive';
  if (pilot.status === 'Suspended') return 'Grounded';
  if (getPilotCertificationState(pilot, 0) === 'expired') return 'Needs Renewal';
  if (getPilotCurrencyState(pilot, 0) === 'due') return 'Needs Renewal';
  if (pilot.readiness_status === 'Grounded') return 'Grounded';

  if (activeMission) {
    return activeMission.status === 'Active' ? 'In Mission' : 'Assigned';
  }

  return pilot.readiness_status || 'Ready';
};

export const isPilotAssignable = (pilot, activeMission = null) => (
  pilot?.status === 'Active' &&
  getPilotReadiness(pilot, activeMission) === 'Ready' &&
  getPilotCertificationState(pilot, 0) !== 'expired' &&
  getPilotCurrencyState(pilot, 0) !== 'due'
);

export const getPilotBlockReason = (pilot, activeMission = null) => {
  if (!pilot) return '';
  if (pilot.status !== 'Active') return `Account status is ${pilot.status}.`;

  const licenceDays = getDaysUntil(pilot.licence_expiry);
  if (licenceDays !== null && licenceDays < 0) return `RPAS licence expired ${Math.abs(licenceDays)} days ago.`;

  const medicalDays = getDaysUntil(pilot.medical_expiry);
  if (medicalDays !== null && medicalDays < 0) return `Medical certificate expired ${Math.abs(medicalDays)} days ago.`;

  const trainingDays = getDaysUntil(pilot.next_training_date);
  if (trainingDays !== null && trainingDays < 0) return `Training check is ${Math.abs(trainingDays)} days overdue.`;

  const currencyDays = getDaysUntil(pilot.next_currency_check);
  if (currencyDays !== null && currencyDays < 0) return `Currency check is ${Math.abs(currencyDays)} days overdue.`;

  const readiness = getPilotReadiness(pilot, activeMission);
  if (readiness !== 'Ready') return `Readiness is ${readiness}.`;

  return '';
};

export const getPilotReadinessStyles = (readiness) => {
  switch ((readiness || '').toLowerCase()) {
    case 'ready':
      return 'bg-status-success/10 text-status-success border-status-success/20';
    case 'assigned':
    case 'in mission':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'needs renewal':
      return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    case 'grounded':
      return 'bg-status-danger/10 text-status-danger border-status-danger/20';
    case 'inactive':
      return 'bg-text-muted/10 text-text-muted border-text-muted/20';
    default:
      return 'bg-bg-elevated text-text-secondary border-border';
  }
};
