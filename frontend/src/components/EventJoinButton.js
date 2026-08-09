import React from 'react';
import { Video } from 'lucide-react';
import { getEventJoinAvailability } from '../utils/eventJoinWindow';

function EventJoinButton({ event, now, className = '', label = 'Join' }) {
  if (!event?.zoomJoinUrl) return null;

  const availability = getEventJoinAvailability(event, now);
  const content = (
    <>
      <Video size={15} aria-hidden="true" />
      {label}
    </>
  );

  if (availability.canJoin) {
    return (
      <a
        href={event.zoomJoinUrl}
        className={className}
        target="_blank"
        rel="noreferrer"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      className="event-join-gate"
      tabIndex={0}
      aria-label={availability.tooltip}
      onClick={(clickEvent) => clickEvent.stopPropagation()}
    >
      <button
        type="button"
        className={`${className} event-join-button--disabled`}
        disabled
        aria-disabled="true"
      >
        {content}
      </button>
      <span className="event-join-tooltip" role="tooltip">
        {availability.tooltip}
      </span>
    </span>
  );
}

export default EventJoinButton;
