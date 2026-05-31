export const normalizeWeatherConditions = (weatherConditions) => {
  if (!weatherConditions) return {};

  if (typeof weatherConditions === 'string') {
    return { condition: weatherConditions };
  }

  return weatherConditions;
};

export const getWeatherConditionText = (weatherConditions) => {
  const weather = normalizeWeatherConditions(weatherConditions);
  return weather.condition || '-';
};

export const getFlightLogReview = (log) => {
  const review = normalizeWeatherConditions(log?.weather_conditions).review;
  const status = (log?.review_status || review?.status || '').toLowerCase();
  const reason = log?.review_notes || review?.reason || '';

  if (log?.approved_by || status === 'approved') {
    return {
      status: 'approved',
      label: 'Approved',
      reason,
      reviewedBy: log?.reviewed_by || review?.reviewed_by || log?.approved_by || null,
      reviewedAt: log?.reviewed_at || review?.reviewed_at || null,
    };
  }

  if (status === 'declined') {
    return {
      status: 'declined',
      label: 'Declined',
      reason,
      reviewedBy: log?.reviewed_by || review?.reviewed_by || null,
      reviewedAt: log?.reviewed_at || review?.reviewed_at || null,
    };
  }

  return {
    status: 'pending',
    label: 'Pending review',
    reason: '',
  };
};

export const withFlightLogReview = (weatherConditions, review) => ({
  ...normalizeWeatherConditions(weatherConditions),
  review,
});
