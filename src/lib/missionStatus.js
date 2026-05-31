export const ACTIVE_MISSION_STATUS = 'Active';

export const getMissionStatusLabel = (status) => (
  status === ACTIVE_MISSION_STATUS ? 'In Progress' : status
);

export const getMissionWorkflowStatus = (status) => (
  status === ACTIVE_MISSION_STATUS ? 'In Progress' : status
);
