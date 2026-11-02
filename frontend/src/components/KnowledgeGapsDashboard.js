import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  Search,
  UserRoundCheck,
} from 'lucide-react';
import { isAdmin } from '../constants/roles';
import { buildApiUrl } from '../utils/apiBase';
import './KnowledgeGapsDashboard.css';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  ready_for_review: 'Ready for review',
  resolved: 'Resolved',
};

const REASON_LABELS = {
  more_detail: 'More detail',
  clearer_steps: 'Clearer next steps',
  institution_specific: 'Information for their institution',
  source_or_contact: 'A source or person to contact',
  personal_help: 'Help with their situation',
  other: 'Something else',
};

const stripMarkup = (value = '') => {
  const clean = DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [] });
  if (typeof document === 'undefined') return clean;
  const element = document.createElement('textarea');
  element.innerHTML = clean;
  return element.value.trim();
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function KnowledgeGapsDashboard({ userData }) {
  const isGlobalAdmin = isAdmin(userData?.role_id);
  const isAmbassadorUser = Number(userData?.is_ambassador) === 1;
  const allowed = isGlobalAdmin || isAmbassadorUser;
  const [statusFilter, setStatusFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [gaps, setGaps] = useState([]);
  const [counts, setCounts] = useState({ open: 0, in_progress: 0, ready_for_review: 0, resolved: 0 });
  const [assignees, setAssignees] = useState([]);
  const [overview, setOverview] = useState({ by_topic: [], by_community: [], common_reason: null });
  const [overviewMode, setOverviewMode] = useState('by_topic');
  const [communityFilter, setCommunityFilter] = useState('');
  const [communityOptions, setCommunityOptions] = useState([]);
  const [viewerScope, setViewerScope] = useState(isGlobalAdmin ? 'global_admin' : 'ambassador');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadGaps = useCallback(async (preferredId = '') => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(buildApiUrl('/api/fetch_knowledge_gaps.php'), {
        params: { status: statusFilter, q: appliedQuery, community_id: communityFilter },
        withCredentials: true,
      });
      const nextGaps = Array.isArray(data.gaps) ? data.gaps : [];
      setGaps(nextGaps);
      setCounts(data.counts || { open: 0, in_progress: 0, ready_for_review: 0, resolved: 0 });
      setAssignees(Array.isArray(data.assignees) ? data.assignees : []);
      setOverview(data.overview || { by_topic: [], by_community: [], common_reason: null });
      setCommunityOptions(Array.isArray(data.communities) ? data.communities : []);
      setViewerScope(data.viewer_scope || (isGlobalAdmin ? 'global_admin' : 'ambassador'));
      const nextId = preferredId && nextGaps.some((gap) => gap.gap_id === preferredId)
        ? preferredId
        : nextGaps[0]?.gap_id || '';
      setSelectedId(nextId);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load knowledge gaps.');
      setGaps([]);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }, [allowed, appliedQuery, communityFilter, isGlobalAdmin, statusFilter]);

  useEffect(() => { loadGaps(); }, [loadGaps]);

  const selected = useMemo(
    () => gaps.find((gap) => gap.gap_id === selectedId) || null,
    [gaps, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      status: selected.status,
      assigned_to: selected.assigned_to || '',
      contributor_notes: selected.contributor_notes || '',
      admin_notes: selected.admin_notes || '',
      resolution_url: selected.resolution_url || '',
    });
    setMessage('');
  }, [selected]);

  const submitUpdate = async (nextDraft, successMessage = '') => {
    if (!selected || !nextDraft) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await axios.post(
        buildApiUrl('/api/update_knowledge_gap.php'),
        { gap_id: selected.gap_id, ...nextDraft },
        { withCredentials: true }
      );
      setMessage(successMessage || data.message || 'Knowledge gap updated.');
      window.dispatchEvent(new Event('sidebarCountsUpdated'));
      await loadGaps(selected.gap_id);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update this knowledge gap.');
    } finally {
      setSaving(false);
    }
  };

  const saveGap = () => submitUpdate(draft);

  const claimGap = () => {
    if (!draft) return;
    const claimedDraft = { ...draft, assigned_to: userData.user_id, status: 'in_progress' };
    setDraft(claimedDraft);
    submitUpdate(claimedDraft, 'This knowledge gap is now assigned to you.');
  };

  const submitForReview = () => {
    if (!draft) return;
    const reviewDraft = { ...draft, assigned_to: userData.user_id, status: 'ready_for_review' };
    setDraft(reviewDraft);
    submitUpdate(reviewDraft, 'Your proposed resolution is ready for administrator review.');
  };

  if (!userData) return <div className="knowledge-gaps__gate">Log in to review knowledge gaps.</div>;
  if (!allowed) return <div className="knowledge-gaps__gate">Only authorized administrators and community ambassadors can review knowledge gaps.</div>;

  const total = Number(counts.open || 0) + Number(counts.in_progress || 0) + Number(counts.ready_for_review || 0) + Number(counts.resolved || 0);
  const ambassadorView = viewerScope === 'ambassador';
  const assignedToViewer = selected && String(selected.assigned_to || '') === String(userData?.user_id || '');
  const assignedToAnother = selected && selected.assigned_to && !assignedToViewer;
  const canContribute = isGlobalAdmin || assignedToViewer;
  const availableAssignees = selected
    ? assignees.filter((person) => Number(person.role_id) >= 4 || (person.community_ids || []).includes(selected.community_id))
    : assignees;
  const overviewRows = Array.isArray(overview[overviewMode]) ? overview[overviewMode] : [];
  const largestOverviewTotal = Math.max(1, ...overviewRows.map((row) => Number(row.total || 0)));
  const commonReason = overview.common_reason?.reason
    ? REASON_LABELS[overview.common_reason.reason] || 'Additional guidance'
    : '';

  return (
    <main className="knowledge-gaps">
      <header className="knowledge-gaps__header">
        <div>
          <p className="knowledge-gaps__eyebrow">Gap-closing operations</p>
          <h1>{ambassadorView ? 'Community knowledge gaps' : 'Knowledge gaps'}</h1>
          <p>{ambassadorView
            ? 'Improve guidance for the communities you represent and send proposed resolutions for review.'
            : 'Turn unresolved feedback into clearer answers and practical next steps.'}</p>
        </div>
        <div className="knowledge-gaps__privacy">
          <LockKeyhole size={18} aria-hidden="true" />
          <span>Reporter identity is hidden. Review only what is needed to improve the guidance.</span>
        </div>
      </header>

      <section className="knowledge-gaps__overview" aria-labelledby="knowledge-gaps-overview-title">
        <div className="knowledge-gaps__overview-head">
          <div>
            <p className="knowledge-gaps__eyebrow">Where guidance is falling short</p>
            <h2 id="knowledge-gaps-overview-title">Gaps that need closing</h2>
          </div>
          <div className="knowledge-gaps__overview-controls">
            <label>
              <span className="sr-only">Filter by community</span>
              <select value={communityFilter} onChange={(event) => setCommunityFilter(event.target.value)}>
                <option value="">All communities</option>
                {communityOptions.map((community) => (
                  <option key={community.id} value={community.id}>{community.name}</option>
                ))}
              </select>
            </label>
            <div className="knowledge-gaps__overview-toggle" role="group" aria-label="Group gaps by">
              <button type="button" className={overviewMode === 'by_topic' ? 'active' : ''} onClick={() => setOverviewMode('by_topic')} aria-pressed={overviewMode === 'by_topic'}>By topic</button>
              <button type="button" className={overviewMode === 'by_community' ? 'active' : ''} onClick={() => setOverviewMode('by_community')} aria-pressed={overviewMode === 'by_community'}>By community</button>
            </div>
          </div>
        </div>

        <div className="knowledge-gaps__overview-body">
          <div className="knowledge-gaps__chart" aria-label={`Unresolved knowledge gaps ${overviewMode === 'by_topic' ? 'by topic' : 'by community'}`}>
            {loading ? <div className="knowledge-gaps__chart-empty">Updating the gap overview…</div> : null}
            {!loading && overviewRows.length === 0 ? (
              <div className="knowledge-gaps__chart-empty">
                <CheckCircle2 size={24} aria-hidden="true" />
                <span>No unresolved gaps in this view.</span>
              </div>
            ) : null}
            {!loading && overviewRows.map((row) => {
              const total = Math.max(1, Number(row.total || 0));
              const barWidth = `${Math.max(8, (total / largestOverviewTotal) * 100)}%`;
              return (
                <div className="knowledge-gaps__chart-row" key={`${overviewMode}-${row.id}`}>
                  <span className="knowledge-gaps__chart-label" title={row.label}>{row.label}</span>
                  <strong>{Number(row.total || 0)}</strong>
                  <div className="knowledge-gaps__chart-track">
                    <div className="knowledge-gaps__chart-bar" style={{ width: barWidth }}>
                      {Number(row.open || 0) > 0 ? <span className="open" style={{ width: `${(Number(row.open) / total) * 100}%` }} title={`${row.open} open`}>{row.open}</span> : null}
                      {Number(row.in_progress || 0) > 0 ? <span className="in-progress" style={{ width: `${(Number(row.in_progress) / total) * 100}%` }} title={`${row.in_progress} in progress`}>{row.in_progress}</span> : null}
                      {Number(row.ready_for_review || 0) > 0 ? <span className="ready" style={{ width: `${(Number(row.ready_for_review) / total) * 100}%` }} title={`${row.ready_for_review} ready for review`}>{row.ready_for_review}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="knowledge-gaps__overview-summary">
            {commonReason ? (
              <div className="knowledge-gaps__insight">
                <BarChart3 size={22} aria-hidden="true" />
                <div>
                  <span>Most common need</span>
                  <strong>{commonReason}</strong>
                  <small>{Number(overview.common_reason.total || 0)} unresolved {Number(overview.common_reason.total || 0) === 1 ? 'response' : 'responses'}</small>
                </div>
              </div>
            ) : null}
            <div className="knowledge-gaps__legend" aria-label="Gap status legend">
              <span><i className="open" /> Open <strong>{Number(counts.open || 0)}</strong></span>
              <span><i className="in-progress" /> In progress <strong>{Number(counts.in_progress || 0)}</strong></span>
              <span><i className="ready" /> Ready for review <strong>{Number(counts.ready_for_review || 0)}</strong></span>
            </div>
          </aside>
        </div>
      </section>

      <section className="knowledge-gaps__metrics" aria-label="Knowledge gap totals">
        {[
          ['all', 'All gaps', total, CircleAlert],
          ['open', 'Open', counts.open, CircleAlert],
          ['in_progress', 'In progress', counts.in_progress, Clock3],
          ['ready_for_review', 'Ready for review', counts.ready_for_review, ClipboardCheck],
          ['resolved', 'Resolved', counts.resolved, CheckCircle2],
        ].map(([key, label, value, Icon]) => (
          <button
            type="button"
            key={key}
            className={statusFilter === key ? 'active' : ''}
            onClick={() => setStatusFilter(key)}
            aria-pressed={statusFilter === key}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <strong>{Number(value || 0)}</strong>
          </button>
        ))}
      </section>

      <form
        className="knowledge-gaps__search"
        onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); }}
      >
        <Search size={19} aria-hidden="true" />
        <label htmlFor="knowledge-gap-search" className="sr-only">Search knowledge gaps</label>
        <input
          id="knowledge-gap-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={120}
          placeholder="Search by question, community, or missing information"
        />
        <button type="submit">Search</button>
      </form>

      {error && <p className="knowledge-gaps__notice knowledge-gaps__notice--error" role="alert">{error}</p>}
      {message && <p className="knowledge-gaps__notice" role="status">{message}</p>}

      <div className="knowledge-gaps__workspace">
        <section className="knowledge-gaps__queue" aria-label="Knowledge gap review queue">
          <div className="knowledge-gaps__section-head">
            <div>
              <p>Review queue</p>
              <h2>{STATUS_LABELS[statusFilter] || 'All'} gaps</h2>
            </div>
            <span>{gaps.length} shown</span>
          </div>

          {loading ? <div className="knowledge-gaps__empty">Loading knowledge gaps…</div> : null}
          {!loading && gaps.length === 0 ? (
            <div className="knowledge-gaps__empty">
              <CheckCircle2 size={28} aria-hidden="true" />
              <h3>No matching gaps</h3>
              <p>There is nothing in this queue right now. Try another status or search.</p>
            </div>
          ) : null}

          {!loading && gaps.map((gap) => (
            <button
              type="button"
              key={gap.gap_id}
              className={`knowledge-gap-card${selectedId === gap.gap_id ? ' active' : ''}`}
              onClick={() => setSelectedId(gap.gap_id)}
            >
              <span className={`knowledge-gap-card__status knowledge-gap-card__status--${gap.status}`}>
                {STATUS_LABELS[gap.status]}
              </span>
              <strong>{gap.thread_title || 'Untitled answer'}</strong>
              <span className="knowledge-gap-card__context">{gap.community_name} · {gap.forum_name}</span>
              <span className="knowledge-gap-card__reason">{REASON_LABELS[gap.missing_reason] || 'The guidance did not fully resolve the need'}</span>
              <span className="knowledge-gap-card__date">Reported {formatDate(gap.created_at)}</span>
            </button>
          ))}
        </section>

        <section className="knowledge-gaps__detail" aria-live="polite">
          {!selected || !draft ? (
            <div className="knowledge-gaps__empty">
              <CircleAlert size={28} aria-hidden="true" />
              <h3>Select a knowledge gap</h3>
              <p>Choose an item from the queue to review the guidance and plan a resolution.</p>
            </div>
          ) : (
            <>
              <div className="knowledge-gaps__detail-head">
                <div>
                  <p>{selected.community_name} · {selected.forum_name}</p>
                  <h2>{selected.thread_title}</h2>
                </div>
                <a href={`/info/forum/${selected.forum_id}/thread/${selected.thread_id}`} target="_blank" rel="noreferrer">
                  View answer <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>

              <div className="knowledge-gaps__signals" aria-label="User feedback signals">
                <span className={selected.helpful === 'no' ? 'negative' : ''}>Helpful: {selected.helpful || 'Not answered'}</span>
                <span className={selected.resolved_signal !== 'yes' ? 'negative' : ''}>Resolved: {selected.resolved_signal || 'Not answered'}</span>
                <span className={selected.next_step_signal !== 'yes' ? 'negative' : ''}>Next step: {selected.next_step_signal || 'Not answered'}</span>
              </div>

              <div className="knowledge-gaps__panel">
                <p className="knowledge-gaps__label">What the answer currently says</p>
                <p className="knowledge-gaps__answer">{stripMarkup(selected.answer_content) || 'No answer preview is available.'}</p>
              </div>

              <div className="knowledge-gaps__panel knowledge-gaps__panel--attention">
                <p className="knowledge-gaps__label">What is still missing</p>
                <h3>{REASON_LABELS[selected.missing_reason] || 'The user did not identify a specific reason.'}</h3>
                {selected.missing_note ? <p>{selected.missing_note}</p> : <p>No additional note was provided.</p>}
              </div>

              <div className="knowledge-gaps__form-grid">
                <label>
                  <span>Status</span>
                  <select disabled={!canContribute} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="ready_for_review">Ready for review</option>
                    {isGlobalAdmin ? <option value="resolved">Resolved</option> : null}
                  </select>
                </label>
                {isGlobalAdmin ? (
                  <label>
                    <span><UserRoundCheck size={16} aria-hidden="true" /> Assigned to</span>
                    <select value={draft.assigned_to} onChange={(event) => setDraft({ ...draft, assigned_to: event.target.value })}>
                      <option value="">Unassigned</option>
                      {availableAssignees.map((person) => (
                        <option key={person.user_id} value={person.user_id}>
                          {person.first_name} {person.last_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="knowledge-gaps__assignment">
                    <span><UserRoundCheck size={16} aria-hidden="true" /> Assignment</span>
                    {!selected.assigned_to ? <button type="button" onClick={claimGap} disabled={saving}>Claim this gap</button> : null}
                    {assignedToViewer ? <strong>Assigned to you</strong> : null}
                    {assignedToAnother ? <strong>Assigned to {selected.assignee_first_name} {selected.assignee_last_name}</strong> : null}
                  </div>
                )}
              </div>

              <label className="knowledge-gaps__field">
                <span>Contributor notes</span>
                <textarea
                  rows={4}
                  maxLength={1000}
                  disabled={!canContribute}
                  value={draft.contributor_notes}
                  onChange={(event) => setDraft({ ...draft, contributor_notes: event.target.value })}
                  placeholder="Describe what should change or what you added to make this guidance more useful."
                />
                <small>{draft.contributor_notes.length}/1000</small>
              </label>

              {isGlobalAdmin ? (
                <label className="knowledge-gaps__field">
                  <span>Administrator review notes</span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={draft.admin_notes}
                    onChange={(event) => setDraft({ ...draft, admin_notes: event.target.value })}
                    placeholder="Add private review context for other global administrators."
                  />
                  <small>{draft.admin_notes.length}/1000</small>
                </label>
              ) : null}

              <label className="knowledge-gaps__field">
                <span>Resolution link <em>Optional</em></span>
                <input
                  type="text"
                  maxLength={500}
                  disabled={!canContribute}
                  value={draft.resolution_url}
                  onChange={(event) => setDraft({ ...draft, resolution_url: event.target.value })}
                  placeholder="Link to the updated answer or resource"
                />
              </label>

              <div className="knowledge-gaps__actions">
                <p>Updated {formatDate(selected.updated_at)}{selected.assignee_first_name ? ` · Assigned to ${selected.assignee_first_name} ${selected.assignee_last_name}` : ''}</p>
                <div className="knowledge-gaps__action-buttons">
                  {ambassadorView && assignedToViewer && draft.status !== 'ready_for_review' ? (
                    <button type="button" className="knowledge-gaps__review-button" onClick={submitForReview} disabled={saving}>
                      Submit for review
                    </button>
                  ) : null}
                  {canContribute ? <button type="button" onClick={saveGap} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button> : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default KnowledgeGapsDashboard;
