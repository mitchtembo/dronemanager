import { supabase } from './supabase';

export const createNotification = async ({
  recipientId,
  title,
  content,
  missionId = null,
  type = 'system',
  priority = 'normal',
  actorId = null,
  flightLogId = null,
  droneId = null,
}) => {
  if (!recipientId) return;

  const allowedPriorities = ['low', 'normal', 'action', 'critical'];

  const { data, error } = await supabase.from('notifications').insert({
    recipient_id: recipientId,
    title: title || 'Notification',
    content: content || '',
    unread: true,
    mission_id: missionId,
    type,
    priority: allowedPriorities.includes(priority) ? priority : 'normal',
    actor_id: actorId,
    flight_log_id: flightLogId,
    drone_id: droneId,
  }).select().single();

  if (error) {
    console.error('Notification insert failed:', error);
    return null;
  }

  return data;
};
