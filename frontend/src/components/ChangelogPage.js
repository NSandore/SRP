import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { buildApiUrl } from '../utils/apiBase';
import './LegalPage.css';
import './ChangelogPage.css';

/**
 * The full, public changelog. Reads the same published entries that drive the
 * login prompt, so publishing once updates both.
 *
 * Deliberately shares the legal pages' document layout and typography rather
 * than defining its own: Changelog, Privacy Policy, and Terms of Service are
 * reached from the same footer links and should read as one set of documents.
 */
function ChangelogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios
      .get(buildApiUrl('/api/fetch_changelog.php?mode=list&limit=100'), { withCredentials: true })
      .then((response) => {
        if (cancelled) return;
        setEntries(Array.isArray(response?.data?.entries) ? response.data.entries : []);
      })
      .catch(() => {
        if (!cancelled) setError('The changelog could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value.replace(' ', 'T')}Z`);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const newest = entries.find((entry) => entry.published_at);

  return (
    <div className="legal-page changelog-page">
      <header className="legal-page__header">
        <p className="legal-page__kicker">Product updates</p>
        <h1 className="legal-page__title">Changelog</h1>
        <p className="legal-page__meta">
          Everything we&rsquo;ve shipped, newest first.
          {newest && formatDate(newest.published_at)
            ? ` Last updated ${formatDate(newest.published_at)}.`
            : ''}
        </p>
      </header>

      {loading && <p className="legal-page__meta">Loading updates&hellip;</p>}
      {!loading && error && <p className="legal-page__meta">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <div className="legal-page__pending">
          <p>No updates have been published yet.</p>
        </div>
      )}

      {entries.map((entry) => {
        const published = formatDate(entry.published_at);
        return (
          <section key={entry.changelog_entry_id} className="legal-page__section changelog-entry">
            <h2>
              {entry.emoji && (
                <span className="changelog-entry__emoji" aria-hidden="true">
                  {entry.emoji}
                </span>
              )}
              {entry.title}
            </h2>

            {(published || entry.version_label) && (
              <p className="changelog-entry__meta">
                {published && <time dateTime={entry.published_at}>{published}</time>}
                {published && entry.version_label && <span aria-hidden="true"> · </span>}
                {entry.version_label && <span>{entry.version_label}</span>}
              </p>
            )}

            {entry.summary && <p>{entry.summary}</p>}

            {entry.body && (
              <div
                className="changelog-entry__body"
                /* Sanitized on write; purified again before it renders. */
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.body) }}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

export default ChangelogPage;
