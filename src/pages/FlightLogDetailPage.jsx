import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../context/AuthContext';
import { createNotification } from '../lib/notifications';
import { getFlightLogReview, getWeatherConditionText, withFlightLogReview } from '../lib/flightLogReview';

const formatDate = (date) => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '-';
  return parsedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const Field = ({ label, value, mono = false }) => (
  <div className="py-3 border-b border-border/50 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
    <span className="text-text-secondary text-sm">{label}</span>
    <span className={`text-text-primary font-semibold text-left sm:text-right break-words ${mono ? 'font-data' : ''}`}>
      {value || '-'}
    </span>
  </div>
);

const FlightLogDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [log, setLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('flight_logs')
        .select(`
          *,
          pilot:pilot_id(id, full_name),
          drone:drone_id(model, serial_number),
          mission:mission_id(id, name, mission_identifier, type, location, status, created_by)
        `)
        .eq('id', id)
        .single();
      if (!error) setLog(data);
      setIsLoading(false);
    };
    fetch();
  }, [id]);

  const handleApprove = async () => {
    setReviewError('');
    setReviewLoading('approved');
    const reviewedAt = new Date().toISOString();
    const note = reviewNote.trim();
    const review = {
      status: 'approved',
      reason: note,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    };
    const { error } = await supabase
      .from('flight_logs')
      .update({
        approved_by: user.id,
        review_status: 'approved',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        review_notes: note || null,
        weather_conditions: withFlightLogReview(log.weather_conditions, review),
      })
      .eq('id', id);

    if (!error) {
      setLog((current) => ({
        ...current,
        approved_by: user.id,
        review_status: 'approved',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        review_notes: note || null,
        weather_conditions: withFlightLogReview(current.weather_conditions, review),
        approver: { email: user.email },
      }));
      await createNotification({
        recipientId: log.pilot_id,
        title: 'Flight log approved',
        content: `Your flight log for "${log.mission?.name || log.mission?.mission_identifier || log.mission_type}" has been approved.`,
        missionId: log.mission_id,
        flightLogId: log.id,
        actorId: user.id,
        type: 'flight_log_approved',
        priority: 'normal',
      });
    } else {
      setReviewError(error.message);
    }
    setReviewLoading('');
  };

  const handleDecline = async () => {
    const reason = reviewNote.trim();
    setReviewError('');

    if (!reason) {
      setReviewError('Please add a short reason before declining the log.');
      return;
    }

    setReviewLoading('declined');
    const reviewedAt = new Date().toISOString();
    const review = {
      status: 'declined',
      reason,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    };

    const { error } = await supabase
      .from('flight_logs')
      .update({
        approved_by: null,
        review_status: 'declined',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        review_notes: reason,
        weather_conditions: withFlightLogReview(log.weather_conditions, review),
      })
      .eq('id', id);

    if (!error) {
      setLog((current) => ({
        ...current,
        approved_by: null,
        review_status: 'declined',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        review_notes: reason,
        weather_conditions: withFlightLogReview(current.weather_conditions, review),
      }));
      await createNotification({
        recipientId: log.pilot_id,
        title: 'Flight log declined',
        content: `Your flight log for "${log.mission?.name || log.mission?.mission_identifier || log.mission_type}" was declined: ${reason}`,
        missionId: log.mission_id,
        flightLogId: log.id,
        actorId: user.id,
        type: 'flight_log_declined',
        priority: 'critical',
      });
    } else {
      setReviewError(error.message);
    }
    setReviewLoading('');
  };

  if (isLoading) return <div className="flex items-center justify-center h-96 text-text-muted">Loading...</div>;
  if (!log) return <div className="flex items-center justify-center h-96 text-text-muted">Log not found.</div>;

  const weatherText = getWeatherConditionText(log.weather_conditions);
  const review = getFlightLogReview(log);
  const canReview = user?.role !== 'pilot' && review.status === 'pending';

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <button onClick={() => navigate('/flight-logs')} className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors">
        <ArrowLeft size={16} />
        Back to flight logs
      </button>

      <div className="card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-text-primary uppercase tracking-wide mb-1">Flight Log</h1>
            <p className="text-text-muted text-sm">
              {log.pilot?.full_name} - {formatDate(log.log_date)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-xs font-semibold uppercase whitespace-nowrap border ${
            review.status === 'approved'
              ? 'bg-status-success/10 text-status-success border-status-success/20'
              : review.status === 'declined'
                ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
                : 'bg-status-warning/10 text-status-warning border-status-warning/20'
          }`}>
            {review.label}
          </span>
        </div>

        <div className="space-y-0">
          <Field label="Flight Date" value={formatDate(log.log_date)} />
          <Field label="Pilot" value={log.pilot?.full_name} />
          <Field label="Drone Model" value={log.drone?.model} />
          <Field label="Serial Number" value={log.drone?.serial_number} mono />
          <Field label="Mission Type" value={log.mission_type} />
          <Field label="Flight Duration" value={`${log.duration_minutes} minutes`} mono />
          <Field label="Departure Location" value={log.departure_location} />
          <Field label="Landing Location" value={log.landing_location} />
          <Field label="Weather Conditions" value={weatherText} />
          {log.mission && <Field label="Linked Mission" value={log.mission.name || log.mission.mission_identifier} />}
          {log.mission && <Field label="Review State" value={review.label} />}
        </div>

        {review.status === 'declined' && (
          <div className="p-4 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={18} />
              Log declined
            </div>
            <p className="text-sm">{review.reason || 'No reason recorded.'}</p>
          </div>
        )}

        {log.incident_reported ? (
          <div className="p-4 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={18} />
              Incident reported
            </div>
            <p className="text-sm">{log.incident_details}</p>
          </div>
        ) : (
          <div className="p-4 rounded bg-status-success/10 text-status-success border border-status-success/20 flex items-center gap-2">
            <CheckCircle size={18} />
            No incidents reported
          </div>
        )}

        {reviewError && (
          <div className="p-3 rounded bg-status-danger/10 text-status-danger border border-status-danger/20 text-sm">
            {reviewError}
          </div>
        )}

        {canReview && (
          <div className="space-y-3 border-t border-border pt-4">
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder="Reason if declining this flight log..."
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleApprove}
                disabled={!!reviewLoading}
                className="btn-primary py-3 text-sm uppercase tracking-wide font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reviewLoading === 'approved' ? 'Approving...' : 'Approve Log'}
              </button>
              <button
                onClick={handleDecline}
                disabled={!!reviewLoading}
                className="rounded border border-status-danger/30 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-status-danger hover:bg-status-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reviewLoading === 'declined' ? 'Declining...' : 'Decline Log'}
              </button>
            </div>
          </div>
        )}

        {review.status === 'pending' && user?.role === 'pilot' && (
          <div className="p-4 rounded bg-status-warning/10 text-status-warning border border-status-warning/20 flex items-center gap-2 text-sm">
            <Clock size={18} className="flex-shrink-0" />
            Awaiting manager review
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightLogDetailPage;
