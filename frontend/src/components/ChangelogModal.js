import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { buildApiUrl } from '../utils/apiBase';
import ModalOverlay from './ModalOverlay';
import './ChangelogModal.css';

/**
 * Prompts a signed-in user with the newest changelog entry published since they
 * last acknowledged one.
 *
 * The server decides eligibility; this component only shows what it is handed,
 * so all four visibility rules live in one place rather than being split
 * between client and backend.
 */
function ChangelogModal({ userData }) {
  const [entry, setEntry] = useState(null);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!userData?.user_id) {
      setEntry(null);
      setOpen(false);
      return undefined;
    }

    let cancelled = false;
    axios
      .get(buildApiUrl('/api/fetch_changelog.php?mode=pending'), { withCredentials: true })
      .then((response) => {
        if (cancelled) return;
        const pending = response?.data?.entry;
        if (pending?.changelog_entry_id) {
          setEntry(pending);
          setOpen(true);
        }
      })
      .catch(() => {
        // A changelog prompt is never important enough to interrupt the app.
      });

    return () => {
      cancelled = true;
    };
  }, [userData?.user_id]);

  const dismiss = useCallback(() => {
    if (!entry?.changelog_entry_id || dismissing) return;
    setDismissing(true);
    setOpen(false);
    // Record the acknowledgement so the same entry is not shown again. Failure
    // is silent: the worst case is seeing it once more next login.
    axios
      .post(
        buildApiUrl('/api/changelog_action.php'),
        { action: 'dismiss', changelog_entry_id: entry.changelog_entry_id },
        { withCredentials: true }
      )
      .catch(() => {})
      .finally(() => setDismissing(false));
  }, [entry, dismissing]);

  if (!open || !entry) {
    return null;
  }

  const publishedLabel = entry.published_at
    ? new Date(`${entry.published_at.replace(' ', 'T')}Z`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <ModalOverlay isOpen={open} onClose={dismiss} contentClassName="changelog-modal">
      <div className="changelog-modal__head">
        {entry.emoji && (
          <span className="changelog-modal__emoji" aria-hidden="true">
            {entry.emoji}
          </span>
        )}
        <div className="changelog-modal__headings">
          <p className="changelog-modal__kicker">What&rsquo;s new</p>
          <h2 className="changelog-modal__title">{entry.title}</h2>
          {(entry.version_label || publishedLabel) && (
            <p className="changelog-modal__meta">
              {entry.version_label && <span className="changelog-modal__version">{entry.version_label}</span>}
              {publishedLabel && <span>{publishedLabel}</span>}
            </p>
          )}
        </div>
      </div>

      {entry.summary && <p className="changelog-modal__summary">{entry.summary}</p>}

      {entry.body && (
        <div
          className="changelog-modal__body"
          /* Sanitized server-side on write; purified again here so a stored
             value can never execute in the browser. */
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.body) }}
        />
      )}

      <div className="changelog-modal__actions">
        <Link to="/changelog" className="changelog-modal__full" onClick={dismiss}>
          See full changelog
        </Link>
        <button type="button" className="changelog-modal__dismiss" onClick={dismiss}>
          Got it
        </button>
      </div>
    </ModalOverlay>
  );
}

export default ChangelogModal;
