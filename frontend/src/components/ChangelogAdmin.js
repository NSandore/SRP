import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { isSuperAdmin } from '../constants/roles';
import { buildApiUrl } from '../utils/apiBase';
import ModalOverlay from './ModalOverlay';
import TextEditor from './TextEditor';
import './ChangelogAdmin.css';

const EMPTY_DRAFT = {
  changelog_entry_id: null,
  title: '',
  emoji: '',
  version_label: '',
  summary: '',
  body: '',
};

/**
 * Super-admin authoring for the product changelog.
 *
 * Publishing an entry both prompts users on their next visit and adds it to the
 * public /changelog page, so there is a single source of truth to maintain.
 */
function ChangelogAdmin({ userData }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const allowed = useMemo(() => isSuperAdmin(Number(userData?.role_id)), [userData?.role_id]);

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get(buildApiUrl('/api/fetch_changelog.php?mode=admin'), { withCredentials: true })
      .then((response) => {
        setEntries(Array.isArray(response?.data?.entries) ? response.data.entries : []);
        setError('');
      })
      .catch(() => setError('The changelog could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [allowed, load]);

  const act = useCallback(
    (payload, successMessage) => {
      setSaving(true);
      setStatus('');
      return axios
        .post(buildApiUrl('/api/changelog_action.php'), payload, { withCredentials: true })
        .then(() => {
          setStatus(successMessage);
          load();
          return true;
        })
        .catch((err) => {
          setStatus(err?.response?.data?.error || 'That action could not be completed.');
          return false;
        })
        .finally(() => setSaving(false));
    },
    [load]
  );

  const saveDraft = useCallback(() => {
    if (!draft?.title.trim()) {
      setStatus('A title is required.');
      return;
    }
    const payload = {
      action: draft.changelog_entry_id ? 'update' : 'create',
      changelog_entry_id: draft.changelog_entry_id || undefined,
      title: draft.title,
      emoji: draft.emoji,
      version_label: draft.version_label,
      summary: draft.summary,
      body: draft.body,
    };
    act(payload, draft.changelog_entry_id ? 'Entry updated.' : 'Draft created.').then((ok) => {
      if (ok) setDraft(null);
    });
  }, [draft, act]);

  const remove = useCallback(
    (entry) => {
      // Deleting a published entry also removes it from the public page, so it
      // is worth a confirmation.
      const label = entry.status === 'published' ? 'published entry' : 'draft';
      if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
      act({ action: 'delete', changelog_entry_id: entry.changelog_entry_id }, 'Entry deleted.');
    },
    [act]
  );

  if (!allowed) {
    return <div className="changelog-admin__gate">Only super admins can manage the changelog.</div>;
  }

  return (
    <div className="changelog-admin">
      <header className="changelog-admin__header">
        <div>
          <p className="changelog-admin__kicker">Product updates</p>
          <h1 className="changelog-admin__title">Changelog</h1>
          <p className="changelog-admin__lead">
            Publishing prompts every user on their next visit and adds the entry to the public page.
          </p>
        </div>
        <button
          type="button"
          className="changelog-admin__primary"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus size={16} aria-hidden="true" /> New entry
        </button>
      </header>

      {status && <p className="changelog-admin__status">{status}</p>}
      {error && <p className="changelog-admin__status">{error}</p>}
      {loading && <p className="changelog-admin__status">Loading&hellip;</p>}

      {!loading && entries.length === 0 && (
        <p className="changelog-admin__status">No changelog entries yet.</p>
      )}

      <ul className="changelog-admin__list">
        {entries.map((entry) => (
          <li key={entry.changelog_entry_id} className="changelog-admin__row">
            <div className="changelog-admin__row-main">
              <div className="changelog-admin__row-head">
                {entry.emoji && <span aria-hidden="true">{entry.emoji}</span>}
                <strong>{entry.title}</strong>
                <span className={`changelog-admin__pill changelog-admin__pill--${entry.status}`}>
                  {entry.status}
                </span>
                {entry.version_label && (
                  <span className="changelog-admin__pill">{entry.version_label}</span>
                )}
              </div>
              {entry.summary && <p className="changelog-admin__summary">{entry.summary}</p>}
              {entry.published_at && (
                <p className="changelog-admin__meta">Published {entry.published_at} UTC</p>
              )}
            </div>
            <div className="changelog-admin__row-actions">
              <button
                type="button"
                title="Edit"
                aria-label={`Edit ${entry.title}`}
                onClick={() =>
                  setDraft({
                    changelog_entry_id: entry.changelog_entry_id,
                    title: entry.title || '',
                    emoji: entry.emoji || '',
                    version_label: entry.version_label || '',
                    summary: entry.summary || '',
                    body: entry.body || '',
                  })
                }
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                title={entry.status === 'published' ? 'Unpublish' : 'Publish'}
                aria-label={entry.status === 'published' ? 'Unpublish entry' : 'Publish entry'}
                disabled={saving}
                onClick={() =>
                  act(
                    {
                      action: entry.status === 'published' ? 'unpublish' : 'publish',
                      changelog_entry_id: entry.changelog_entry_id,
                    },
                    entry.status === 'published' ? 'Entry unpublished.' : 'Entry published.'
                  )
                }
              >
                {entry.status === 'published' ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                title="Delete"
                aria-label={`Delete ${entry.title}`}
                disabled={saving}
                onClick={() => remove(entry)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {draft && (
        <ModalOverlay
          isOpen
          onClose={() => setDraft(null)}
          contentClassName="changelog-admin__modal"
        >
          <h2 className="changelog-admin__modal-title">
            {draft.changelog_entry_id ? 'Edit entry' : 'New entry'}
          </h2>

          <div className="changelog-admin__field-row">
            <label className="changelog-admin__field changelog-admin__field--emoji">
              Emoji
              <input
                type="text"
                value={draft.emoji}
                maxLength={8}
                placeholder="🚀"
                onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
              />
            </label>
            <label className="changelog-admin__field">
              Title
              <input
                type="text"
                value={draft.title}
                maxLength={255}
                placeholder="What shipped?"
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
            <label className="changelog-admin__field changelog-admin__field--version">
              Version
              <input
                type="text"
                value={draft.version_label}
                maxLength={40}
                placeholder="v1.4"
                onChange={(e) => setDraft((d) => ({ ...d, version_label: e.target.value }))}
              />
            </label>
          </div>

          <label className="changelog-admin__field">
            Summary
            <input
              type="text"
              value={draft.summary}
              maxLength={500}
              placeholder="One line shown in the popup."
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </label>

          <div className="changelog-admin__field">
            <span>Details</span>
            <TextEditor
              value={draft.body}
              onChange={(value) => setDraft((d) => ({ ...d, body: value }))}
            />
            <small className="changelog-admin__hint">
              Full release notes. Emojis, lists, and links are all fine.
            </small>
          </div>

          <div className="changelog-admin__modal-actions">
            <button type="button" className="changelog-admin__ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="changelog-admin__primary"
              disabled={saving}
              onClick={saveDraft}
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </div>
          <p className="changelog-admin__hint">
            Saving keeps this as a draft. Publish it from the list when you are ready to prompt users.
          </p>
        </ModalOverlay>
      )}
    </div>
  );
}

export default ChangelogAdmin;
