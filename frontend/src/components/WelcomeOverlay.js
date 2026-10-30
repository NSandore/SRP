import React, { useEffect, useRef } from 'react';
import {
  FaArrowRight,
  FaCompass,
  FaRegClock,
  FaUserGraduate,
  FaUsers,
} from 'react-icons/fa';
import './WelcomeOverlay.css';

function WelcomeOverlay({ firstName = '', onExplore, onDismiss }) {
  const primaryActionRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  const safeFirstName = typeof firstName === 'string' ? firstName.trim() : '';

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    primaryActionRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onDismissRef.current?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      className="welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-description"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss?.();
        }
      }}
    >
      <section className="welcome-message">
        <div className="welcome-guide">
          <span className="welcome-guide__avatar" aria-hidden="true">
            <FaUserGraduate />
          </span>
          <div className="welcome-guide__identity">
            <span className="welcome-guide__label">Your getting-started guide</span>
            <strong>Here to point you in the right direction</strong>
          </div>
          <span className="welcome-guide__time">
            <FaRegClock aria-hidden="true" />
            About a minute
          </span>
        </div>

        <div className="welcome-message__body">
          <p className="welcome-kicker">
            {safeFirstName ? `Hi ${safeFirstName} — welcome in.` : 'Hi there — welcome in.'}
          </p>
          <h1 id="welcome-title">Let’s get you settled.</h1>
          <p id="welcome-description" className="welcome-description">
            Start by meeting student ambassadors—real students who can answer campus questions and help you find your way around.
          </p>

          <div className="welcome-preview" aria-label="A few things you can do">
            <span>
              <FaUsers aria-hidden="true" />
              Meet helpful people
            </span>
            <span>
              <FaCompass aria-hidden="true" />
              Find your communities
            </span>
          </div>

          <div className="welcome-actions">
            <button
              ref={primaryActionRef}
              type="button"
              className="get-started-button"
              onClick={onExplore}
            >
              Meet the ambassadors
              <FaArrowRight aria-hidden="true" />
            </button>
            <button type="button" className="welcome-secondary" onClick={onDismiss}>
              I’ll explore on my own
            </button>
          </div>
          <p className="welcome-footnote">No pressure—you can explore at your own pace.</p>
        </div>
      </section>
    </div>
  );
}

export default WelcomeOverlay;
