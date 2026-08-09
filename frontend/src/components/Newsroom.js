import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Archive,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FilePenLine,
  FileText,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { isSuperAdmin } from '../constants/roles';
import { POST_MAX_LENGTH, THREAD_TITLE_MAX_LENGTH } from '../utils/contentLimits';
import ModalOverlay from './ModalOverlay';
import TextEditor from './TextEditor';
import './Newsroom.css';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
  { key: 'dismissed', label: 'Dismissed' },
];

const EMPTY_MANUAL_ITEM = {
  title: '',
  summary: '',
  sourceName: 'U.S. Department of Education',
  sourceUrl: '',
  publishedAt: '',
};

const getItemId = (item) =>
  String(item?.newsroom_item_id ?? item?.news_item_id ?? item?.item_id ?? item?.id ?? '');

const normalizeStatus = (status) => {
  const value = String(status || 'new').trim().toLowerCase();
  if (['draft', 'generated', 'review', 'ready'].includes(value)) return 'draft';
  if (['published', 'posted'].includes(value)) return 'published';
  if (['dismissed', 'archived', 'ignored'].includes(value)) return 'dismissed';
  return 'new';
};

const stripHtml = (value = '') =>
  String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const hasMeaningfulHtml = (value) => stripHtml(value).length > 0;

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const sourceNameFor = (item) =>
  item?.source_name || item?.sourceName || item?.source || 'Incoming source';

const sourceUrlFor = (item) =>
  item?.source_url || item?.sourceUrl || item?.url || item?.link || '';

const titleFor = (item) =>
  item?.title || item?.source_title || item?.headline || '';

const summaryFor = (item) =>
  item?.summary
  || item?.source_content
  || item?.description
  || item?.excerpt
  || item?.content
  || '';

const publishedDateFor = (item) =>
  item?.published_at || item?.source_published_at || item?.publishedAt || item?.created_at || '';

const forumIdFor = (forum) =>
  String(forum?.forum_id ?? forum?.id ?? '');

const forumLabelFor = (forum) => {
  const forumName = forum?.name || forum?.forum_name || 'Untitled forum';
  const communityName = forum?.community_name || forum?.communityName || '';
  return communityName ? `${communityName} — ${forumName}` : forumName;
};

function Newsroom({ userData }) {
  const isAllowed = isSuperAdmin(userData?.role_id);
  const [items, setItems] = useState([]);
  const [forums, setForums] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeStatus, setActiveStatus] = useState('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualItem, setManualItem] = useState(EMPTY_MANUAL_ITEM);
  const [manualError, setManualError] = useState('');

  const [reviewItem, setReviewItem] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftForumId, setDraftForumId] = useState('');
  const [draftTags, setDraftTags] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const loadNewsroom = useCallback(async ({ quiet = false } = {}) => {
    if (!isAllowed) return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/fetch_newsroom.php', {
        withCredentials: true,
      });
      if (response.data?.success === false) {
        throw new Error(response.data?.error || 'Unable to load the newsroom.');
      }
      const nextItems = response.data?.items || response.data?.news_items || [];
      const nextForums = response.data?.forums || [];
      setItems(Array.isArray(nextItems) ? nextItems : []);
      setForums(Array.isArray(nextForums) ? nextForums : []);
      setAiAvailable(Boolean(response.data?.ai_available));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to load the newsroom.'
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [isAllowed]);

  useEffect(() => {
    loadNewsroom();
  }, [loadNewsroom]);

  const postAction = async (action, payload = {}) => {
    const response = await axios.post(
      '/api/newsroom_action.php',
      { action, ...payload },
      { withCredentials: true }
    );
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'The newsroom action could not be completed.');
    }
    return response.data || {};
  };

  const counts = useMemo(() => {
    const next = {
      all: items.length,
      new: 0,
      draft: 0,
      published: 0,
      dismissed: 0,
    };
    items.forEach((item) => {
      const status = normalizeStatus(item?.status);
      next[status] += 1;
    });
    return next;
  }, [items]);

  const sourceCount = useMemo(
    () => new Set(items.map(sourceNameFor).filter(Boolean)).size,
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (activeStatus !== 'all' && normalizeStatus(item?.status) !== activeStatus) {
        return false;
      }
      if (!query) return true;
      return [
        titleFor(item),
        summaryFor(item),
        sourceNameFor(item),
        item?.draft_title,
        item?.draft?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeStatus, items, searchTerm]);

  const openReview = (item, actionResponse = null) => {
    const returnedDraft = actionResponse?.draft || actionResponse?.item?.draft || {};
    const nextItem = actionResponse?.item || item;
    const nextTitle =
      returnedDraft.title
      || actionResponse?.draft_title
      || nextItem?.draft_title
      || nextItem?.draft?.title
      || titleFor(nextItem)
      || '';
    const nextBody =
      returnedDraft.body
      || returnedDraft.content
      || actionResponse?.draft_body
      || actionResponse?.draft_content
      || nextItem?.draft_body
      || nextItem?.draft_content
      || nextItem?.draft?.body
      || nextItem?.draft?.content
      || '';
    const nextForumId = String(
      returnedDraft.forum_id
      || actionResponse?.forum_id
      || nextItem?.forum_id
      || nextItem?.draft?.forum_id
      || ''
    );
    const nextTags =
      returnedDraft.tags
      || actionResponse?.draft_tags
      || nextItem?.draft_tags
      || nextItem?.draft?.tags
      || [];

    setReviewItem(nextItem);
    setDraftTitle(nextTitle);
    setDraftBody(nextBody);
    setDraftForumId(nextForumId);
    setDraftTags(Array.isArray(nextTags) ? nextTags : []);
    setReviewError('');
    setEditorKey((key) => key + 1);
  };

  const closeReview = () => {
    if (busyAction.startsWith('review:')) return;
    setReviewItem(null);
    setReviewError('');
  };

  const handleSync = async () => {
    setBusyAction('sync');
    setError('');
    setNotice('');
    try {
      const result = await postAction('sync_official');
      setNotice(result.message || 'Education news sources are up to date.');
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to sync education news.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    const title = manualItem.title.trim();
    const sourceUrl = manualItem.sourceUrl.trim();
    if (!title) {
      setManualError('Add a headline for this item.');
      return;
    }
    if (!sourceUrl) {
      setManualError('Add the original source URL for this item.');
      return;
    }
    setBusyAction('manual');
    setManualError('');
    setNotice('');
    try {
      const result = await postAction('add_manual', {
        title,
        summary: manualItem.summary.trim(),
        source_name: manualItem.sourceName.trim() || 'Manual source',
        source_url: sourceUrl,
        published_at: manualItem.publishedAt || null,
      });
      setManualItem(EMPTY_MANUAL_ITEM);
      setShowManualForm(false);
      setNotice(result.message || 'The article was added to the review queue.');
      setActiveStatus('new');
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setManualError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to add this article.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleGenerateDraft = async (item) => {
    const itemId = getItemId(item);
    if (!itemId) return;
    setBusyAction(`generate:${itemId}`);
    setError('');
    setNotice('');
    try {
      const result = await postAction('generate_draft', { item_id: itemId });
      openReview(item, result);
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to generate a thread draft.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const validateReview = (publishing = false) => {
    if (!draftTitle.trim()) {
      setReviewError('Add a thread title before continuing.');
      return false;
    }
    if (!hasMeaningfulHtml(draftBody)) {
      setReviewError('Add content for the first post before continuing.');
      return false;
    }
    if (publishing && !draftForumId) {
      setReviewError('Choose the forum where this thread should be published.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!reviewItem || !validateReview(false)) return;
    const itemId = getItemId(reviewItem);
    setBusyAction(`review:save:${itemId}`);
    setReviewError('');
    try {
      const result = await postAction('save_draft', {
        item_id: itemId,
        draft_title: draftTitle.trim(),
        draft_body: draftBody,
        forum_id: draftForumId || null,
        tags: draftTags,
      });
      setNotice(result.message || 'Draft saved for later review.');
      setReviewItem(null);
      setActiveStatus('draft');
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setReviewError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to save this draft.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handlePublish = async () => {
    if (!reviewItem || !validateReview(true)) return;
    const itemId = getItemId(reviewItem);
    setBusyAction(`review:publish:${itemId}`);
    setReviewError('');
    try {
      const result = await postAction('publish', {
        item_id: itemId,
        forum_id: draftForumId,
        draft_title: draftTitle.trim(),
        draft_body: draftBody,
        tags: draftTags,
      });
      setNotice(result.message || 'The thread is now published.');
      setReviewItem(null);
      setActiveStatus('published');
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setReviewError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to publish this thread.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleDismiss = async (item) => {
    const itemId = getItemId(item);
    if (!itemId) return;
    setBusyAction(`dismiss:${itemId}`);
    setError('');
    setNotice('');
    try {
      const result = await postAction('dismiss', { item_id: itemId });
      setNotice(result.message || 'The article was dismissed.');
      await loadNewsroom({ quiet: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || 'Unable to dismiss this article.'
      );
    } finally {
      setBusyAction('');
    }
  };

  if (!userData) {
    return (
      <section className="newsroom-access-card">
        <Newspaper aria-hidden="true" />
        <h1>Newsroom access</h1>
        <p>Log in with a super-admin account to review incoming education news.</p>
      </section>
    );
  }

  if (!isAllowed) {
    return (
      <section className="newsroom-access-card">
        <Archive aria-hidden="true" />
        <h1>Access restricted</h1>
        <p>Only StudentSphere super admins can use the Newsroom.</p>
      </section>
    );
  }

  const isReviewBusy = busyAction.startsWith('review:');
  const selectedStatus = reviewItem ? normalizeStatus(reviewItem.status) : 'new';

  return (
    <div className="newsroom">
      <header className="newsroom-hero">
        <div className="newsroom-hero__copy">
          <p className="newsroom-eyebrow">Super-admin publishing desk</p>
          <h1>Newsroom</h1>
          <p>
            Review trusted education updates, shape them into useful context, and
            publish a discussion only when it is ready.
          </p>
          <div className={`newsroom-ai-state${aiAvailable ? ' is-ready' : ''}`}>
            <Sparkles size={15} aria-hidden="true" />
            {aiAvailable ? 'AI drafting is available' : 'Guided draft templates are available'}
          </div>
        </div>
        <div className="newsroom-hero__actions">
          <button
            type="button"
            className="newsroom-button newsroom-button--secondary"
            onClick={handleSync}
            disabled={busyAction === 'sync'}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={busyAction === 'sync' ? 'is-spinning' : ''}
            />
            {busyAction === 'sync' ? 'Syncing…' : 'Sync Education News'}
          </button>
          <button
            type="button"
            className="newsroom-button newsroom-button--primary"
            onClick={() => {
              setManualError('');
              setShowManualForm(true);
            }}
          >
            <Plus size={17} aria-hidden="true" />
            Add item
          </button>
        </div>
      </header>

      <section className="newsroom-metrics" aria-label="Newsroom overview">
        <article>
          <span className="newsroom-metric-icon newsroom-metric-icon--new"><Clock3 /></span>
          <div>
            <strong>{counts.new}</strong>
            <span>New to review</span>
          </div>
        </article>
        <article>
          <span className="newsroom-metric-icon newsroom-metric-icon--draft"><FilePenLine /></span>
          <div>
            <strong>{counts.draft}</strong>
            <span>Saved drafts</span>
          </div>
        </article>
        <article>
          <span className="newsroom-metric-icon newsroom-metric-icon--published"><CheckCircle2 /></span>
          <div>
            <strong>{counts.published}</strong>
            <span>Published threads</span>
          </div>
        </article>
        <article>
          <span className="newsroom-metric-icon newsroom-metric-icon--sources"><Newspaper /></span>
          <div>
            <strong>{sourceCount}</strong>
            <span>Incoming sources</span>
          </div>
        </article>
      </section>

      {(notice || error) && (
        <div className={`newsroom-message ${error ? 'is-error' : 'is-success'}`} role="status">
          {error || notice}
        </div>
      )}

      <section className="newsroom-workspace">
        <div className="newsroom-toolbar">
          <div className="newsroom-tabs" role="tablist" aria-label="Filter newsroom items">
            {STATUS_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab.key}
                aria-selected={activeStatus === tab.key}
                className={activeStatus === tab.key ? 'is-active' : ''}
                onClick={() => setActiveStatus(tab.key)}
              >
                {tab.label}
                <span>{counts[tab.key]}</span>
              </button>
            ))}
          </div>
          <label className="newsroom-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search newsroom articles</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search headline or source"
            />
          </label>
        </div>

        {loading ? (
          <div className="newsroom-empty">
            <RefreshCw className="is-spinning" aria-hidden="true" />
            <h2>Loading the news desk</h2>
            <p>Gathering incoming articles and saved drafts…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="newsroom-empty">
            <FileText aria-hidden="true" />
            <h2>No items in this view</h2>
            <p>
              {searchTerm
                ? 'Try a broader search or choose another status.'
                : 'Sync trusted sources or add an article manually to begin.'}
            </p>
          </div>
        ) : (
          <div className="newsroom-list">
            {filteredItems.map((item) => {
              const itemId = getItemId(item);
              const status = normalizeStatus(item.status);
              const sourceUrl = sourceUrlFor(item);
              const sourceDate = formatDate(publishedDateFor(item));
              const isGenerating = busyAction === `generate:${itemId}`;
              const isDismissing = busyAction === `dismiss:${itemId}`;
              const threadId = item.thread_id || item.published_thread_id;
              const threadForumId = item.thread_forum_id || item.forum_id;
              const threadUrl =
                item.thread_url
                || (
                  threadId && threadForumId
                    ? `/info/forum/${threadForumId}/thread/${threadId}`
                    : ''
                );

              return (
                <article className="newsroom-item" key={itemId}>
                  <div className="newsroom-item__source-mark" aria-hidden="true">
                    <Newspaper size={20} />
                  </div>
                  <div className="newsroom-item__content">
                    <div className="newsroom-item__meta">
                      <span className={`newsroom-status newsroom-status--${status}`}>
                        {status === 'new' ? 'New' : status}
                      </span>
                      <span>{sourceNameFor(item)}</span>
                      {sourceDate && <span>{sourceDate}</span>}
                    </div>
                    <h2>{titleFor(item) || 'Untitled incoming article'}</h2>
                    {summaryFor(item) && (
                      <p className="newsroom-item__summary">
                        {stripHtml(summaryFor(item))}
                      </p>
                    )}
                    <div className="newsroom-item__links">
                      {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                          Read original
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                      {threadUrl && (
                        <a href={threadUrl}>
                          View published thread
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="newsroom-item__actions">
                    {status === 'new' && (
                      <button
                        type="button"
                        className="newsroom-button newsroom-button--primary"
                        onClick={() => handleGenerateDraft(item)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <RefreshCw size={16} className="is-spinning" aria-hidden="true" />
                        ) : (
                          <Sparkles size={16} aria-hidden="true" />
                        )}
                        {isGenerating ? 'Preparing…' : aiAvailable ? 'Generate draft' : 'Prepare draft'}
                      </button>
                    )}
                    {status === 'draft' && (
                      <button
                        type="button"
                        className="newsroom-button newsroom-button--primary"
                        onClick={() => openReview(item)}
                      >
                        <FilePenLine size={16} aria-hidden="true" />
                        Review draft
                      </button>
                    )}
                    {status !== 'dismissed' && status !== 'published' && (
                      <button
                        type="button"
                        className="newsroom-button newsroom-button--quiet"
                        onClick={() => handleDismiss(item)}
                        disabled={isDismissing}
                      >
                        <Archive size={16} aria-hidden="true" />
                        {isDismissing ? 'Dismissing…' : 'Dismiss'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ModalOverlay
        isOpen={showManualForm}
        onClose={() => {
          if (busyAction === 'manual') return;
          setShowManualForm(false);
          setManualError('');
        }}
        contentClassName="newsroom-modal-shell newsroom-manual-shell"
      >
        <div className="newsroom-dialog">
          <header className="newsroom-dialog__header">
            <p className="newsroom-dialog__eyebrow">Manual intake</p>
            <h2>Add an incoming article</h2>
            <p>Save a trusted link to the same review queue as synced education news.</p>
          </header>
          <form className="newsroom-form" onSubmit={handleManualSubmit}>
            <label>
              <span>Headline</span>
              <input
                type="text"
                value={manualItem.title}
                onChange={(event) => setManualItem((item) => ({ ...item, title: event.target.value }))}
                placeholder="Article headline"
                required
              />
            </label>
            <div className="newsroom-form__row">
              <label>
                <span>Source</span>
                <input
                  type="text"
                  value={manualItem.sourceName}
                  onChange={(event) => setManualItem((item) => ({ ...item, sourceName: event.target.value }))}
                  placeholder="Publisher or agency"
                />
              </label>
              <label>
                <span>Publication date</span>
                <input
                  type="date"
                  value={manualItem.publishedAt}
                  onChange={(event) => setManualItem((item) => ({ ...item, publishedAt: event.target.value }))}
                />
              </label>
            </div>
            <label>
              <span>Source URL</span>
              <input
                type="url"
                value={manualItem.sourceUrl}
                onChange={(event) => setManualItem((item) => ({ ...item, sourceUrl: event.target.value }))}
                placeholder="https://www.ed.gov/…"
                required
              />
            </label>
            <label>
              <span>Review note <small>Optional</small></span>
              <textarea
                value={manualItem.summary}
                onChange={(event) => setManualItem((item) => ({ ...item, summary: event.target.value }))}
                placeholder="Why this may be useful to students and university communities"
                rows={5}
              />
            </label>
            {manualError && <p className="newsroom-form__error" role="alert">{manualError}</p>}
            <div className="newsroom-dialog__actions">
              <button
                type="button"
                className="newsroom-button newsroom-button--quiet"
                onClick={() => setShowManualForm(false)}
                disabled={busyAction === 'manual'}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="newsroom-button newsroom-button--primary"
                disabled={busyAction === 'manual'}
              >
                {busyAction === 'manual' ? 'Adding…' : 'Add to review queue'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      <ModalOverlay
        isOpen={Boolean(reviewItem)}
        onClose={closeReview}
        contentClassName="newsroom-modal-shell newsroom-review-shell"
      >
        {reviewItem && (
          <div className="newsroom-review">
            <aside className="newsroom-review__source">
              <div className="newsroom-review__source-icon">
                <Newspaper aria-hidden="true" />
              </div>
              <p className="newsroom-dialog__eyebrow">Source material</p>
              <h2>{titleFor(reviewItem) || 'Incoming article'}</h2>
              <div className="newsroom-item__meta">
                <span className={`newsroom-status newsroom-status--${selectedStatus}`}>
                  {selectedStatus}
                </span>
                <span>{sourceNameFor(reviewItem)}</span>
              </div>
              {summaryFor(reviewItem) && <p>{stripHtml(summaryFor(reviewItem))}</p>}
              {sourceUrlFor(reviewItem) && (
                <a
                  className="newsroom-review__source-link"
                  href={sourceUrlFor(reviewItem)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original source
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
              <div className="newsroom-review__note">
                <Sparkles size={17} aria-hidden="true" />
                <p>
                  This draft is a starting point. Verify every claim, preserve source
                  context, and edit for the StudentSphere audience before publishing.
                </p>
              </div>
            </aside>

            <section className="newsroom-review__editor">
              <header className="newsroom-dialog__header">
                <p className="newsroom-dialog__eyebrow">Editorial review</p>
                <h2>Prepare the discussion thread</h2>
                <p>Nothing is posted until you select Publish thread.</p>
              </header>
              <div className="newsroom-form">
                <label>
                  <span>Thread title</span>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="A clear, student-centered discussion title"
                    maxLength={THREAD_TITLE_MAX_LENGTH}
                  />
                  <small>{draftTitle.length} / {THREAD_TITLE_MAX_LENGTH}</small>
                </label>
                <label>
                  <span>Destination forum</span>
                  <select
                    value={draftForumId}
                    onChange={(event) => setDraftForumId(event.target.value)}
                  >
                    <option value="">Choose a forum</option>
                    {forums.map((forum) => (
                      <option key={forumIdFor(forum)} value={forumIdFor(forum)}>
                        {forumLabelFor(forum)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="newsroom-editor-field">
                  <span>First post</span>
                  <TextEditor
                    key={`${getItemId(reviewItem)}-${editorKey}`}
                    value={draftBody}
                    onChange={setDraftBody}
                    maxLength={POST_MAX_LENGTH}
                  />
                </div>
                {reviewError && <p className="newsroom-form__error" role="alert">{reviewError}</p>}
                <div className="newsroom-dialog__actions newsroom-review__actions">
                  <button
                    type="button"
                    className="newsroom-button newsroom-button--quiet"
                    onClick={closeReview}
                    disabled={isReviewBusy}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="newsroom-button newsroom-button--secondary"
                    onClick={handleSaveDraft}
                    disabled={isReviewBusy}
                  >
                    {busyAction.includes(':save:') ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="newsroom-button newsroom-button--primary"
                    onClick={handlePublish}
                    disabled={isReviewBusy || !draftForumId}
                  >
                    {busyAction.includes(':publish:') ? 'Publishing…' : 'Publish thread'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}

export default Newsroom;
