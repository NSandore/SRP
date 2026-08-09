import { EVENT_JOIN_LEAD_MINUTES, getEventJoinAvailability } from './eventJoinWindow';

describe('getEventJoinAvailability', () => {
  const event = {
    date: '2026-07-12T18:00:00.000Z',
    zoomDuration: 60,
    timezone: 'UTC',
  };

  it('keeps the call closed before the ten-minute lead window', () => {
    const result = getEventJoinAvailability(event, Date.parse('2026-07-12T17:49:59.000Z'));

    expect(EVENT_JOIN_LEAD_MINUTES).toBe(10);
    expect(result.canJoin).toBe(false);
    expect(result.tooltip).toMatch(/^This call will be joinable at /);
  });

  it('opens the call exactly ten minutes before the event', () => {
    const result = getEventJoinAvailability(event, Date.parse('2026-07-12T17:50:00.000Z'));

    expect(result.canJoin).toBe(true);
  });

  it('closes the call after its duration has elapsed', () => {
    const result = getEventJoinAvailability(event, Date.parse('2026-07-12T19:00:00.001Z'));

    expect(result).toEqual({ canJoin: false, tooltip: 'This call has ended.' });
  });

  it('fails closed when an event has no valid start time', () => {
    expect(getEventJoinAvailability({}, Date.now())).toEqual({
      canJoin: false,
      tooltip: 'Join time is not available yet.',
    });
  });
});
