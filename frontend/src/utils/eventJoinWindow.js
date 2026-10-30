export const EVENT_JOIN_LEAD_MINUTES = 10;

const formatJoinTime = (timestamp, timezone) => {
  const date = new Date(timestamp);
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };

  try {
    return date.toLocaleString(undefined, timezone ? { ...options, timeZone: timezone } : options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
};

export const getEventJoinAvailability = (event, now = Date.now()) => {
  const startTimestamp = Date.parse(event?.date || event?.startAt || '');
  if (Number.isNaN(startTimestamp)) {
    return {
      canJoin: false,
      tooltip: 'Join time is not available yet.',
    };
  }

  const opensAt = startTimestamp - EVENT_JOIN_LEAD_MINUTES * 60 * 1000;
  const explicitEnd = Date.parse(event?.endDate || event?.endAt || '');
  const durationMinutes = Math.max(Number(event?.zoomDuration || event?.durationMinutes || 60), 0);
  const endsAt = Number.isNaN(explicitEnd)
    ? startTimestamp + durationMinutes * 60 * 1000
    : explicitEnd;

  if (now < opensAt) {
    return {
      canJoin: false,
      tooltip: `This call will be joinable at ${formatJoinTime(opensAt, event?.timezone)}.`,
    };
  }

  if (now > endsAt) {
    return {
      canJoin: false,
      tooltip: 'This call has ended.',
    };
  }

  return {
    canJoin: true,
    tooltip: 'Join call',
  };
};
