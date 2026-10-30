import React, { useEffect, useRef, useState } from 'react';
import {
  FaBell,
  FaEnvelope,
  FaFlask,
  FaRoute,
  FaStar,
  FaUsers,
} from 'react-icons/fa';
import './TestControls.css';

const ACTIONS = [
  {
    id: 'guide',
    label: 'Replay guide',
    description: 'Start the product walkthrough from step one.',
    icon: FaRoute,
    handler: 'onReplayGuide',
    restoreFocus: false,
  },
  {
    id: 'notification',
    label: 'Test notification',
    description: 'Create an unread alert and open the bell tray.',
    icon: FaBell,
    handler: 'onTestNotification',
  },
  {
    id: 'welcome',
    label: 'Show welcome',
    description: 'Preview the first-login welcome screen.',
    icon: FaStar,
    handler: 'onShowWelcome',
    restoreFocus: false,
  },
  {
    id: 'ambassadors',
    label: 'Show ambassadors',
    description: 'Open the ambassador discovery overlay.',
    icon: FaUsers,
    handler: 'onShowAmbassadors',
    restoreFocus: false,
  },
  {
    id: 'email',
    label: 'Send test email',
    description: 'Send a MailerSend diagnostic to this account.',
    icon: FaEnvelope,
    handler: 'onSendTestEmail',
  },
];

function TestControls(props) {
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const runAction = async (action) => {
    const handler = props[action.handler];
    if (typeof handler !== 'function' || busyAction) return;

    setBusyAction(action.id);
    setError('');
    try {
      await handler();
      setOpen(false);
      if (action.restoreFocus !== false) {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    } catch (actionError) {
      setError(actionError?.message || 'That test could not be started.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className={`test-controls${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="test-controls__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="test-controls-panel"
        onClick={() => {
          setError('');
          setOpen((current) => !current);
        }}
      >
        <FaFlask aria-hidden="true" />
        <span>Test tools</span>
      </button>

      <div
        id="test-controls-panel"
        className="test-controls__panel"
        role="dialog"
        aria-label="Account test tools"
        aria-hidden={!open}
        aria-busy={Boolean(busyAction)}
      >
        <div className="test-controls__header">
          <div>
            <p className="test-controls__eyebrow">Test account</p>
            <h2>Preview tools</h2>
          </div>
          <span className="test-controls__private">Only you</span>
        </div>
        <p className="test-controls__intro">
          Trigger member-facing states without granting this account admin access.
        </p>
        <div className="test-controls__actions">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const isBusy = busyAction === action.id;
            return (
              <button
                key={action.id}
                type="button"
                className="test-controls__action"
                onClick={() => runAction(action)}
                disabled={Boolean(busyAction)}
              >
                <span className="test-controls__action-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="test-controls__action-copy">
                  <strong>{isBusy ? 'Starting…' : action.label}</strong>
                  <small>{action.description}</small>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="test-controls__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default TestControls;
