import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { isSuperAdmin } from '../constants/roles';
import './InstitutionDataReview.css';

const STATUS_OPTIONS = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'failed', label: 'Failed refresh' },
  { value: 'missing', label: 'Missing data' },
  { value: 'refresh_requested', label: 'Refresh requested' },
  { value: 'all', label: 'All institutions' },
];

const EMPTY_OVERRIDE = {
  field: '',
  value: '',
  source_url: '',
  notes: '',
};

const MANUAL_OVERRIDE_FIELDS = [
  'official_name',
  'aliases',
  'former_names',
  'website',
  'normalized_domain',
  'phone',
  'location',
  'address',
  'city',
  'state',
  'zip',
  'county',
  'latitude',
  'longitude',
  'institution_sector',
  'institution_level',
  'institution_control',
  'accreditor',
  'degree_granting',
  'operating_status',
  'is_hbcu',
  'is_tribal_college',
  'pipeline_active',
  'primary_color',
  'secondary_color',
  'motto',
  'slogan',
  'tagline',
  'nickname',
  'logo_url',
  'logo_thumbnail_url',
  'logo_type',
  'logo_mime_type',
  'logo_license_name',
  'logo_license_url',
  'logo_attribution',
  'ipeds_unitid',
  'wikidata_id',
  'ope_id',
].sort();

const NON_OVERRIDABLE_FIELDS = new Set([
  'source_reporting_year',
  'logo_width',
  'logo_height',
]);

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const asArray = (value) => (Array.isArray(value) ? value : []);

const humanize = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const candidateSource = (candidate = {}) =>
  candidate.source_type || candidate.source || candidate.source_name || 'Unknown source';

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isWebUrl = (value) => /^https?:\/\//i.test(String(value || ''));

function InstitutionDataReview({ userData }) {
  const [status, setStatus] = useState('needs_review');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [overrideDrafts, setOverrideDrafts] = useState({});
  // Inline values for the missing-field inputs, keyed "<communityId>:<field>"
  // so several institutions can be part-filled without clobbering each other.
  const [missingDrafts, setMissingDrafts] = useState({});
  // Bumped after a logo upload, which writes through a different endpoint and
  // so cannot patch a single row from its response.
  const [refreshKey, setRefreshKey] = useState(0);
  const [duplicateDrafts, setDuplicateDrafts] = useState({});
  const allowed = isSuperAdmin(userData?.role_id);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!allowed) return undefined;
    const controller = new AbortController();
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get('/api/fetch_institution_reviews.php', {
          params: {
            status,
            q: debouncedQuery,
            page,
            limit: 30,
          },
          withCredentials: true,
          signal: controller.signal,
        });
        if (!mounted) return;
        setReviews(Array.isArray(response.data?.reviews) ? response.data.reviews : []);
        setPagination({
          total: Number(response.data?.pagination?.total || 0),
          page: Number(response.data?.pagination?.page || page),
          total_pages: Math.max(1, Number(response.data?.pagination?.total_pages || 1)),
        });
      } catch (requestError) {
        if (!mounted || requestError?.code === 'ERR_CANCELED') return;
        setReviews([]);
        setError(requestError?.response?.data?.error || 'Unable to load institution reviews.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [allowed, status, debouncedQuery, page, refreshKey]);

  const updateReview = (updated) => {
    if (!updated?.id) return;
    setReviews((current) =>
      current.map((review) => (String(review.id) === String(updated.id) ? updated : review))
    );
  };

  const runAction = async (review, action, payload = {}) => {
    const key = `${review.id}:${action}:${payload.field ?? ''}:${payload.candidate_index ?? ''}`;
    setBusyAction(key);
    setError('');
    try {
      const response = await axios.post(
        '/api/institution_review_action.php',
        {
          action,
          community_id: review.id,
          ...payload,
        },
        { withCredentials: true }
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'The review action could not be completed.');
      }
      if (response.data.review) {
        updateReview(response.data.review);
      }
      return true;
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'The review action could not be completed.'
      );
      return false;
    } finally {
      setBusyAction('');
    }
  };

  const setDraft = (reviewId, patch) => {
    setOverrideDrafts((current) => ({
      ...current,
      [reviewId]: {
        ...EMPTY_OVERRIDE,
        ...(current[reviewId] || {}),
        ...patch,
      },
    }));
  };

  /**
   * Upload a logo file for one institution.
   *
   * A logo is a file, not a string, so it cannot go through the text override
   * path. This posts to the existing community update endpoint, which stores
   * the image under uploads/logos, sets logo_path, and records it as a
   * platform-approved manual value the pipeline will not overwrite.
   */
  const uploadLogo = async (review, file) => {
    if (!file) return;
    setBusyAction(`${review.id}:logo_upload`);
    setError('');
    try {
      const form = new FormData();
      form.append('community_id', review.id);
      form.append('logo', file);
      const response = await axios.post('/api/update_university.php', form, {
        withCredentials: true,
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'The logo could not be uploaded.');
      }
      // The response is a community record, not a review record, so reload
      // rather than patching the row with a mismatched shape.
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'The logo could not be uploaded.'
      );
    } finally {
      setBusyAction('');
    }
  };

  /**
   * Save one missing field straight from its inline input.
   *
   * Uses the same set_manual_override action as the full form below, so an
   * administrator typing a value here gets identical provenance, confidence,
   * and verification handling rather than a second, weaker write path.
   */
  const submitMissingField = async (review, field) => {
    const key = `${review.id}:${field}`;
    const value = (missingDrafts[key] || '').trim();
    if (value === '') {
      setError(`Enter a value for ${humanize(field)} before saving.`);
      return;
    }
    const completed = await runAction(review, 'set_manual_override', {
      field,
      value,
      notes: 'Entered by an administrator from the missing-data view.',
    });
    if (completed) {
      setMissingDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const submitOverride = async (review) => {
    const draft = { ...EMPTY_OVERRIDE, ...(overrideDrafts[review.id] || {}) };
    if (!draft.field || draft.value === '') {
      setError('Choose a field and enter a value for the manual override.');
      return;
    }
    const completed = await runAction(review, 'set_manual_override', draft);
    if (completed) {
      setOverrideDrafts((current) => ({ ...current, [review.id]: EMPTY_OVERRIDE }));
    }
  };

  const emptyMessage = useMemo(() => {
    if (loading) return 'Loading institution records…';
    if (error) return error;
    if (debouncedQuery) return 'No institution records match this search.';
    if (status === 'needs_review') return 'No institution records currently need review.';
    return 'No institution records are in this view.';
  }, [loading, error, debouncedQuery, status]);

  if (!userData) {
    return <div className="institution-review__gate">Log in to review institution data.</div>;
  }

  if (!allowed) {
    return <div className="institution-review__gate">Only super admins can review institution data.</div>;
  }

  return (
    <section className="institution-review" aria-labelledby="institution-review-title">
      <header className="institution-review__header">
        <div>
          <p className="institution-review__eyebrow">Data operations</p>
          <h1 id="institution-review-title">Institution data review</h1>
          <p className="institution-review__subtitle">
            Resolve source conflicts, verify selected values, and queue focused refreshes.
          </p>
        </div>
        <div className="institution-review__summary" aria-live="polite">
          <strong>{pagination.total}</strong>
          <span>{pagination.total === 1 ? 'record' : 'records'}</span>
        </div>
      </header>

      <div className="institution-review__controls">
        <div className="institution-review__filters" aria-label="Review status">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={status === option.value ? 'is-active' : ''}
              aria-pressed={status === option.value}
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="institution-review__search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search institution reviews</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search school, state, or UNITID"
          />
        </label>
      </div>

      {error && reviews.length > 0 ? (
        <div className="institution-review__alert" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {reviews.length === 0 ? (
        <div className="institution-review__empty" role="status">
          {loading ? <RefreshCw className="institution-review__spinner" size={20} aria-hidden="true" /> : null}
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <div className="institution-review__list" aria-busy={loading}>
          {reviews.map((review) => {
            const candidates = asObject(review.data_candidates);
            const overrides = asObject(review.manual_overrides);
            const sources = asObject(review.data_sources);
            const confidence = asObject(review.data_confidence);
            const verified = asObject(review.data_verified);
            const reasons = asArray(review.review_reasons);
            const missingFields = asArray(review.missing_fields);
            const candidateFields = Object.keys(candidates).filter((field) =>
              Array.isArray(candidates[field]) && candidates[field].length > 0
            );
            const lowConfidenceFields = Object.keys(confidence).filter((field) => {
              const value = Number(confidence[field]);
              return Number.isFinite(value) && value < 0.8;
            });
            const reviewFields = Array.from(
              new Set([...candidateFields, ...lowConfidenceFields, ...Object.keys(overrides)])
            ).sort();
            const fieldOptions = MANUAL_OVERRIDE_FIELDS;
            const draft = { ...EMPTY_OVERRIDE, ...(overrideDrafts[review.id] || {}) };
            const expanded = String(expandedId) === String(review.id);
            const duplicateReview = reasons.some((reason) =>
              JSON.stringify(reason).toLowerCase().includes('duplicate')
            );

            return (
              <article className="institution-review__card" key={review.id}>
                <button
                  type="button"
                  className="institution-review__card-toggle"
                  onClick={() => setExpandedId(expanded ? '' : review.id)}
                  aria-expanded={expanded}
                  aria-controls={`institution-review-details-${review.id}`}
                >
                  <span className="institution-review__identity">
                    <span className="institution-review__name">
                      {review.name || review.official_name || 'Unnamed institution'}
                    </span>
                    <span className="institution-review__meta">
                      {[review.city || review.location, review.state].filter(Boolean).join(', ') || 'Location unavailable'}
                      {review.ipeds_unitid ? ` · UNITID ${review.ipeds_unitid}` : ''}
                    </span>
                  </span>
                  <span className="institution-review__signals">
                    {review.pipeline_last_error ? (
                      <span className="institution-review__pill institution-review__pill--error">
                        Refresh failed
                      </span>
                    ) : null}
                    {reasons.length > 0 ? (
                      <span className="institution-review__pill">
                        {reasons.length} {reasons.length === 1 ? 'issue' : 'issues'}
                      </span>
                    ) : null}
                    {missingFields.length > 0 ? (
                      <span className="institution-review__pill institution-review__pill--quiet">
                        {missingFields.length} missing
                      </span>
                    ) : null}
                    {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                  </span>
                </button>

                {/* Sits outside the toggle button: a link nested inside a
                    button is invalid and breaks keyboard activation. */}
                <div className="institution-review__card-links">
                  <Link
                    to={`/university/${review.id}`}
                    className="institution-review__community-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    View community page
                  </Link>
                </div>

                {expanded ? (
                  <div className="institution-review__details" id={`institution-review-details-${review.id}`}>
                    <div className="institution-review__overview">
                      <div>
                        <span>Match</span>
                        <strong>{humanize(review.pipeline_match_method || 'Not recorded')}</strong>
                      </div>
                      <div>
                        <span>Match confidence</span>
                        <strong>
                          {review.pipeline_match_confidence === null || review.pipeline_match_confidence === undefined
                            ? 'Not recorded'
                            : `${Math.round(Number(review.pipeline_match_confidence) * 100)}%`}
                        </strong>
                      </div>
                      <div>
                        <span>Directory status</span>
                        <strong>{review.is_active === false || Number(review.pipeline_active) === 0 ? 'Inactive' : 'Active'}</strong>
                      </div>
                      <div>
                        <span>Last seen</span>
                        <strong>{review.last_seen_at || 'Not recorded'}</strong>
                      </div>
                    </div>

                    {reasons.length > 0 ? (
                      <div className="institution-review__reason-box">
                        <h2>Review reasons</h2>
                        <ul>
                          {reasons.map((reason, index) => (
                            <li key={`${review.id}-reason-${index}`}>
                              {typeof reason === 'string'
                                ? humanize(reason)
                                : humanize(reason.message || reason.reason || reason.code || JSON.stringify(reason))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {missingFields.length > 0 ? (
                      <div className="institution-review__fill">
                        <div className="institution-review__fill-head">
                          <strong>Fill in missing data</strong>
                          <span>
                            Saved as a verified manual value, which outranks every automated
                            source.
                          </span>
                        </div>
                        <div className="institution-review__fill-grid">
                          {missingFields.map((field) => {
                            const key = `${review.id}:${field}`;
                            const busyKey = `${review.id}:set_manual_override`;

                            // "logo" is a derived field, not a text column, so
                            // it takes a file rather than an override string.
                            if (field === 'logo') {
                              const uploading = busyAction === `${review.id}:logo_upload`;
                              return (
                                <label key={field} className="institution-review__fill-field">
                                  <span>Logo</span>
                                  <div className="institution-review__fill-upload">
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                      disabled={uploading}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = '';
                                        uploadLogo(review, file);
                                      }}
                                    />
                                    {uploading ? <em>Uploading…</em> : null}
                                  </div>
                                </label>
                              );
                            }

                            return (
                              <label key={field} className="institution-review__fill-field">
                                <span>{humanize(field)}</span>
                                <div className="institution-review__fill-input">
                                  <input
                                    type="text"
                                    value={missingDrafts[key] || ''}
                                    placeholder={`Add ${humanize(field).toLowerCase()}`}
                                    onChange={(event) =>
                                      setMissingDrafts((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        submitMissingField(review, field);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      busyAction === busyKey || !(missingDrafts[key] || '').trim()
                                    }
                                    onClick={() => submitMissingField(review, field)}
                                  >
                                    Save
                                  </button>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="institution-review__field-list">
                      {reviewFields.length === 0 ? (
                        <div className="institution-review__subtle-empty">
                          No alternate source candidates are stored for this institution.
                        </div>
                      ) : reviewFields.map((field) => {
                        const currentValue = review[field];
                        const currentSource = asObject(sources[field]).source_type;
                        const fieldVerified = Boolean(asObject(verified[field]).verified);
                        return (
                          <section className="institution-review__field" key={field}>
                            <div className="institution-review__field-header">
                              <div>
                                <h2>{humanize(field)}</h2>
                                <p>
                                  Selected: <strong>{displayValue(currentValue)}</strong>
                                  {confidence[field] !== undefined
                                    ? ` · ${Math.round(Number(confidence[field]) * 100)}% confidence`
                                    : ''}
                                  {currentSource ? ` · ${humanize(currentSource)}` : ''}
                                </p>
                              </div>
                              <div className="institution-review__field-status">
                                {fieldVerified ? (
                                  <span><ShieldCheck size={15} /> Verified</span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyAction !== ''}
                                    onClick={() => runAction(review, 'mark_verified', { field, verified: true })}
                                  >
                                    <ShieldCheck size={15} /> Mark verified
                                  </button>
                                )}
                              </div>
                            </div>

                            {asArray(candidates[field]).length > 0 ? (
                              <div className="institution-review__candidate-list">
                                {asArray(candidates[field]).map((candidate, index) => {
                                const candidateStatus = candidate.status || 'pending';
                                const candidateActionable = ![
                                  'approved',
                                  'rejected',
                                  'manual_rejected',
                                  'selected',
                                  'superseded',
                                ].includes(candidateStatus);
                                const candidateApprovable = !NON_OVERRIDABLE_FIELDS.has(field);
                                const sourceUrl = candidate.source_url || candidate.url || '';
                                const actionPrefix = `${review.id}:`;
                                return (
                                  <div
                                    className={`institution-review__candidate institution-review__candidate--${candidateStatus}`}
                                    key={`${field}-${index}-${displayValue(candidate.value)}`}
                                  >
                                    <div className="institution-review__candidate-copy">
                                      <strong>{displayValue(candidate.value)}</strong>
                                      <span>
                                        {humanize(candidateSource(candidate))}
                                        {candidate.confidence !== undefined
                                          ? ` · ${Math.round(Number(candidate.confidence) * 100)}%`
                                          : ''}
                                      </span>
                                      {isWebUrl(sourceUrl) ? (
                                        <a href={sourceUrl} target="_blank" rel="noreferrer">
                                          View source <ExternalLink size={13} />
                                        </a>
                                      ) : null}
                                    </div>
                                    <div className="institution-review__candidate-actions">
                                      {candidateActionable ? (
                                        <>
                                          {candidateApprovable ? (
                                            <button
                                              type="button"
                                              className="institution-review__approve"
                                              disabled={busyAction !== ''}
                                              onClick={() =>
                                                runAction(review, 'approve_candidate', {
                                                  field,
                                                  candidate_index: index,
                                                })
                                              }
                                            >
                                              <Check size={15} />
                                              {busyAction.startsWith(actionPrefix) ? 'Working…' : 'Approve'}
                                            </button>
                                          ) : null}
                                          <button
                                            type="button"
                                            className="institution-review__reject"
                                            disabled={busyAction !== ''}
                                            onClick={() =>
                                              runAction(review, 'reject_candidate', {
                                                field,
                                                candidate_index: index,
                                              })
                                            }
                                          >
                                            <X size={15} /> Reject
                                          </button>
                                        </>
                                      ) : (
                                        <span className="institution-review__candidate-state">
                                          {humanize(candidateStatus)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              </div>
                            ) : null}

                            {overrides[field] ? (
                              <div className="institution-review__override">
                                <div>
                                  <span>Manual override</span>
                                  <strong>{displayValue(overrides[field].value)}</strong>
                                </div>
                                <button
                                  type="button"
                                  disabled={busyAction !== ''}
                                  onClick={() => {
                                    if (window.confirm(`Clear the manual override for ${humanize(field)}?`)) {
                                      runAction(review, 'clear_manual_override', { field });
                                    }
                                  }}
                                >
                                  <RotateCcw size={15} /> Clear override
                                </button>
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>

                    <section className="institution-review__manual">
                      <div>
                        <h2>Set a manual override</h2>
                        <p>Manual values take priority over future automated source updates.</p>
                      </div>
                      <div className="institution-review__manual-grid">
                        <label>
                          Field
                          <select
                            value={draft.field}
                            onChange={(event) => setDraft(review.id, { field: event.target.value })}
                          >
                            <option value="">Choose a field</option>
                            {fieldOptions.map((field) => (
                              <option key={field} value={field}>{humanize(field)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Value
                          <input
                            value={draft.value}
                            onChange={(event) => setDraft(review.id, { value: event.target.value })}
                            placeholder="Verified value"
                          />
                        </label>
                        <label>
                          Source URL
                          <input
                            type="url"
                            value={draft.source_url}
                            onChange={(event) => setDraft(review.id, { source_url: event.target.value })}
                            placeholder="https://…"
                          />
                        </label>
                        <label className="institution-review__manual-notes">
                          Notes
                          <input
                            value={draft.notes}
                            onChange={(event) => setDraft(review.id, { notes: event.target.value })}
                            placeholder="Why this value is authoritative"
                          />
                        </label>
                        <button
                          type="button"
                          className="institution-review__primary"
                          disabled={busyAction !== ''}
                          onClick={() => submitOverride(review)}
                        >
                          <ShieldCheck size={16} /> Save override
                        </button>
                      </div>
                    </section>

                    {duplicateReview ? (
                      <section className="institution-review__duplicate">
                        <div>
                          <h2>Potential duplicate</h2>
                          <p>Record a review decision without merging IDs or changing relationships.</p>
                        </div>
                        <div>
                          <button
                            type="button"
                            disabled={busyAction !== ''}
                            onClick={() =>
                              runAction(review, 'resolve_duplicate', {
                                duplicate_resolution: 'not_duplicate',
                              })
                            }
                          >
                            Not a duplicate
                          </button>
                          <button
                            type="button"
                            disabled={busyAction !== ''}
                            onClick={() =>
                              runAction(review, 'resolve_duplicate', {
                                duplicate_resolution: 'defer',
                              })
                            }
                          >
                            Defer decision
                          </button>
                          <label>
                            <span className="sr-only">Canonical institution ID</span>
                            <input
                              value={duplicateDrafts[review.id] || ''}
                              onChange={(event) =>
                                setDuplicateDrafts((current) => ({
                                  ...current,
                                  [review.id]: event.target.value,
                                }))
                              }
                              placeholder="Canonical community ID"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busyAction !== '' || !String(duplicateDrafts[review.id] || '').trim()}
                            onClick={() =>
                              runAction(review, 'resolve_duplicate', {
                                duplicate_resolution: 'duplicate_of',
                                value: String(duplicateDrafts[review.id] || '').trim(),
                              })
                            }
                          >
                            Mark duplicate of
                          </button>
                        </div>
                      </section>
                    ) : null}

                    <footer className="institution-review__footer">
                      <div>
                        {review.pipeline_last_error ? (
                          <span className="institution-review__last-error">
                            <AlertTriangle size={15} />
                            {review.pipeline_last_error}
                          </span>
                        ) : (
                          <span>Automated refreshes run outside web requests.</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="institution-review__refresh"
                        disabled={busyAction !== ''}
                        onClick={() => runAction(review, 'request_refresh')}
                      >
                        <RefreshCw size={16} /> Request focused refresh
                      </button>
                    </footer>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {pagination.total_pages > 1 ? (
        <nav className="institution-review__pagination" aria-label="Institution review pages">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.total_pages}</span>
          <button
            type="button"
            disabled={page >= pagination.total_pages || loading}
            onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}

export default InstitutionDataReview;
