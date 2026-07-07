// src/components/ForumView.js
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import TextEditor from './TextEditor';
import './ForumView.css';  // Adjusted to match feed styling
import './CreationModal.css';
import ModalOverlay from './ModalOverlay';
import { FaEllipsisV, FaArrowAltCircleUp, FaRegArrowAltCircleUp, FaArrowAltCircleDown, FaRegArrowAltCircleDown } from 'react-icons/fa';
import ThreadCard from './ThreadCard';
import ReportModal from './ReportModal';
import TagPicker from './TagPicker';
import useTagOptions from '../hooks/useTagOptions';
import { mapTagNamesToSlugs, normalizeTagValue } from '../utils/tagUtils';
import { isSuperAdmin } from '../constants/roles';
import { buildAvatarSrc } from '../utils/avatar';
import buildUploadSrc from '../utils/uploads';
import { getTagStyle } from '../utils/tagStyle';

// Sorting function
const sortItems = (items, criteria) => {
  const sorted = [...items];
  switch (criteria) {
    case 'popularity':
      sorted.sort((a, b) =>
        (parseInt(b.upvotes, 10) + parseInt(b.downvotes, 10)) -
        (parseInt(a.upvotes, 10) + parseInt(a.downvotes, 10))
      );
      break;
    case 'mostUpvoted':
      sorted.sort((a, b) => parseInt(b.upvotes, 10) - parseInt(a.upvotes, 10));
      break;
    case 'mostRecent':
    default:
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
  }
  return sorted;
};

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 3600) {
    const mins = Math.max(1, Math.floor(seconds / 60));
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.max(1, Math.round(seconds / 3600));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

function ForumView({ userData, onRequireAuth }) {
  const { forum_id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tags: tagOptions } = useTagOptions();

  // Forum data & threads
  const [forumData, setForumData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting
  const [sortBy, setSortBy] = useState('mostRecent');
  const [showTagFilter, setShowTagFilter] = useState(false);

  // Tag filter
  const [activeTags, setActiveTags] = useState([]);
  const tagNameToSlug = useMemo(
    () => new Map((tagOptions || []).map((opt) => [opt.name, opt.slug])),
    [tagOptions]
  );
  const tagNameLowerToSlug = useMemo(
    () => new Map((tagOptions || []).map((opt) => [String(opt.name || '').toLowerCase(), opt.slug])),
    [tagOptions]
  );
  const tagNameNormalizedToSlug = useMemo(
    () => new Map((tagOptions || []).map((opt) => [normalizeTagValue(opt.name || ''), opt.slug])),
    [tagOptions]
  );
  const tagSlugSet = useMemo(
    () => new Set((tagOptions || []).map((opt) => String(opt.slug || '').toLowerCase()).filter(Boolean)),
    [tagOptions]
  );

  const resolveTagSlug = useMemo(
    () => (value) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const lower = raw.toLowerCase();
      if (tagSlugSet.has(lower)) return lower;
      const byName = tagNameLowerToSlug.get(lower);
      if (byName) return byName;
      const normalized = normalizeTagValue(raw);
      if (tagSlugSet.has(normalized)) return normalized;
      const byNormalizedName = tagNameNormalizedToSlug.get(normalized);
      if (byNormalizedName) return byNormalizedName;
      return normalized;
    },
    [tagNameLowerToSlug, tagNameNormalizedToSlug, tagSlugSet]
  );

  // Create Thread
  const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [firstPostContent, setFirstPostContent] = useState('');
  const [threadTags, setThreadTags] = useState([]);
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Edit Thread
  const [editThreadId, setEditThreadId] = useState(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [editThreadTags, setEditThreadTags] = useState([]);
  const [isEditingThread, setIsEditingThread] = useState(false);

  // Notification
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  // Saved Threads
  const [savedThreads, setSavedThreads] = useState([]);

  // Ambassador communities for visibility gating
  const [ambassadorCommunities, setAmbassadorCommunities] = useState([]);

  // Reporting modal
  const [reportTarget, setReportTarget] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // kebab menu handled inside ThreadCard

  // Helper to detect if a thread is saved
  const isThreadSaved = (threadId) =>
    savedThreads.some((t) => Number(t.thread_id) === Number(threadId));

  // === API Calls ===
  const fetchForumDetails = async () => {
    try {
      const res = await axios.get(`/api/fetch_forum.php?forum_id=${forum_id}`);
      setForumData(res.data);
    } catch (err) {
      console.error('Error fetching forum details:', err);
      setNotification({ type: 'error', message: 'Failed to load forum details.' });
    }
  };

  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const userId = userData ? userData.user_id : 0;
      const res = await axios.get(`/api/fetch_threads.php?forum_id=${forum_id}&user_id=${userId}`);
      setThreads(res.data || []);
    } catch (err) {
      console.error('Error fetching threads:', err);
      setNotification({ type: 'error', message: 'Failed to load threads.' });
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedThreads = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(`/api/fetch_saved_threads.php?user_id=${userData.user_id}`, {
        withCredentials: true,
      });
      if (resp.data.success) {
        setSavedThreads(resp.data.saved_threads || []);
      }
    } catch (error) {
      console.error('Error fetching saved threads:', error);
    }
  };

  useEffect(() => {
    fetchForumDetails();
    fetchThreads();
    if (userData) {
      fetchSavedThreads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum_id, userData]);

  useEffect(() => {
    const param = searchParams.get('tag') || searchParams.get('tags') || '';
    const parsed = param
      ? param
          .split(',')
          .map((value) => resolveTagSlug(value))
          .filter(Boolean)
      : [];
    const unique = Array.from(new Set(parsed));
    setActiveTags(unique);
  }, [searchParams, resolveTagSlug]);

  const handleTagFilter = (tag) => {
    const slug = resolveTagSlug(tag);
    if (!slug) return;
    const current = new Set(activeTags);
    if (current.has(slug)) {
      current.delete(slug);
    } else {
      current.add(slug);
    }
    const next = Array.from(current);
    const params = new URLSearchParams(searchParams);
    params.delete('tag');
    if (next.length) {
      params.set('tags', next.join(','));
    } else {
      params.delete('tags');
    }
    setSearchParams(params);
    setActiveTags(next);
  };

  const handleTagSelect = (event) => {
    const value = event?.target?.value || '';
    if (!value) {
      const params = new URLSearchParams(searchParams);
      params.delete('tag');
      params.delete('tags');
      setSearchParams(params);
      setActiveTags([]);
      return;
    }
    handleTagFilter(value);
  };

  const tagSlugToName = useMemo(
    () => new Map((tagOptions || []).map((opt) => [opt.slug, opt.name])),
    [tagOptions]
  );

  const activeTagLabel = activeTags.length
    ? activeTags
        .map((slug) => tagSlugToName.get(slug) || slug)
        .join(', ')
    : 'All tags';

  // Load ambassador communities when user is ambassador
  useEffect(() => {
    const loadAmbassadorCommunities = async () => {
      if (!userData || Number(userData.is_ambassador) !== 1) return;
      try {
        const res = await axios.get(`/api/fetch_ambassador_communities.php?user_id=${userData.user_id}`);
        const list = Array.isArray(res.data) ? res.data : (res.data.communities || res.data.ambassador_communities || []);
        setAmbassadorCommunities(list);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching ambassador communities:', e);
        setAmbassadorCommunities([]);
      }
    };
    loadAmbassadorCommunities();
  }, [userData]);

  // Sort threads
  const filteredThreads = activeTags.length
    ? threads.filter((thread) => {
        if (!Array.isArray(thread.tags) || thread.tags.length === 0) return false;
        return thread.tags.some((tag) => activeTags.includes(resolveTagSlug(tag)));
      })
    : threads;
  const sortedThreads = sortItems(filteredThreads, sortBy);

  // kebab menu handled inside ThreadCard

  const promptAuthOverlay = () => {
    if (onRequireAuth) {
      onRequireAuth();
    }
  };

  // === Thread CRUD / Voting ===
  const handleToggleSaveThread = async (threadId) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }

    const alreadySaved = isThreadSaved(threadId);
    const endpoint = alreadySaved ? '/api/unsave_thread.php' : '/api/save_thread.php';
    try {
      const resp = await axios.post(
        endpoint,
        { user_id: userData.user_id, thread_id: threadId },
        { withCredentials: true }
      );
      if (resp.data.success) {
        fetchSavedThreads();
        setNotification({
          type: 'success',
          message: alreadySaved ? 'Thread unsaved!' : 'Thread saved!',
        });
      } else {
        setNotification({
          type: 'error',
          message: resp.data.error || 'Error saving thread.',
        });
      }
    } catch (error) {
      console.error('Error saving/unsaving thread:', error);
      setNotification({ type: 'error', message: 'Error saving/unsaving thread.' });
    }
    // ThreadCard manages its own kebab menu state
  };

  const handleUpvoteClick = async (threadId) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    try {
      await axios.post('/api/vote_thread.php', {
        thread_id: threadId,
        user_id: userData.user_id,
        vote_type: 'up',
      });
      fetchThreads();
    } catch (err) {
      console.error('Error upvoting thread:', err);
    }
  };

  const handleDownvoteClick = async (threadId) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    try {
      await axios.post('/api/vote_thread.php', {
        thread_id: threadId,
        user_id: userData.user_id,
        vote_type: 'down',
      });
      fetchThreads();
    } catch (err) {
      console.error('Error downvoting thread:', err);
    }
  };

  const handleCreateThreadSubmit = async (e) => {
    e.preventDefault();
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    setIsCreatingThread(true);
    try {
      const resp = await axios.post('/api/create_thread.php', {
        forum_id,
        user_id: userData.user_id,
        title: threadTitle,
        firstPostContent,
        tags: threadTags,
      });
      if (resp.data.success) {
        setThreadTitle('');
        setFirstPostContent('');
        setThreadTags([]);
        setShowCreateThreadModal(false);
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread created successfully!' });
      } else {
        setNotification({
          type: 'error',
          message: resp.data.error || 'Unknown error creating thread.',
        });
      }
    } catch (err) {
      console.error('Error creating thread:', err);
      setNotification({
        type: 'error',
        message: err?.response?.data?.error || 'An error occurred while creating the thread.',
      });
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleDismissCreateThreadModal = () => {
    setShowCreateThreadModal(false);
    setThreadTitle('');
    setFirstPostContent('');
    setThreadTags([]);
    setIsCreatingThread(false);
  };

  const handleDeleteThread = async (threadId) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    try {
      const resp = await axios.post('/api/delete_thread.php', { thread_id: threadId });
      if (resp.data.success) {
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread deleted successfully.' });
      } else {
        setNotification({
          type: 'error',
          message: resp.data.error || 'Error deleting thread.',
        });
      }
    } catch (err) {
      console.error('Error deleting thread:', err);
      setNotification({
        type: 'error',
        message: 'An error occurred while deleting the thread.',
      });
    }
  };

  const handleOpenReport = (target) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    if (!target || !target.id || !target.type) return;
    setReportTarget({
      ...target,
      label: target.label || target.type,
      context: target.context ? target.context.trim() : '',
    });
  };

  const handleSubmitReport = async ({ reasonCode, reasonText, details }) => {
    if (!reportTarget) return;
    setIsSubmittingReport(true);
    try {
      const resp = await axios.post(
        '/api/submit_report.php',
        {
          item_type: reportTarget.type,
          item_id: reportTarget.id,
          reason_code: reasonCode,
          reason_text: reasonText,
          details,
        },
        { withCredentials: true }
      );
      if (resp.data.success) {
        setNotification({ type: 'success', message: 'Report submitted.' });
        setReportTarget(null);
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Unable to submit report.' });
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setNotification({ type: 'error', message: 'An error occurred while submitting the report.' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const startEditingThread = (thread) => {
    setEditThreadId(thread.thread_id);
    setEditThreadTitle('');
    setEditThreadTags(mapTagNamesToSlugs(thread.tags || [], tagOptions));
    setIsEditingThread(true);
  };

  const cancelEditingThread = () => {
    setEditThreadId(null);
    setEditThreadTitle('');
    setEditThreadTags([]);
    setIsEditingThread(false);
  };

  const handleEditThreadSubmit = async (e) => {
    e.preventDefault();
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    try {
      const resp = await axios.post('/api/edit_thread.php', {
        thread_id: editThreadId,
        new_title: editThreadTitle,
        tags: editThreadTags,
      });
      if (resp.data.success) {
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread updated successfully!' });
      } else {
        setNotification({
          type: 'error',
          message: resp.data.error || 'Error editing thread.',
        });
      }
    } catch (err) {
      console.error('Error editing thread:', err);
      setNotification({
        type: 'error',
        message: 'An error occurred while editing the thread.',
      });
    } finally {
      setIsEditingThread(false);
      setEditThreadId(null);
      setEditThreadTitle('');
    }
  };

  if (isLoading) {
    return (
      <div className="feed-container forum-view forum-view--loading">
        <p>Loading Threads...</p>
      </div>
    );
  }

  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const isAmbassador = Number(userData?.is_ambassador) === 1;
  const communityId = forumData?.community_id;
  const ambassadorHasAccess =
    isAmbassador &&
    communityId &&
    ambassadorCommunities.some((c) => {
      const id = c?.community_id ?? c?.id ?? c;
      return Number(id) === Number(communityId);
    });
  const canCreateThread = Boolean(userData && (isSuperAdminUser || ambassadorHasAccess));
  const bannerSrc = buildUploadSrc(forumData?.banner_path || '/uploads/banners/DefaultBanner.jpeg');

  return (
    <div className="feed-container forum-view">
      {/* Breadcrumbs */}
      <div className="forum-header-row">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/info">Info Board</Link>
          <span className="breadcrumb-sep">&gt;</span>
          {/*<span className="breadcrumb-current" aria-current="page">
            {forumData?.name ? forumData.name : `Forum ${forum_id}`}
          </span>*/}
        </nav>
      </div>

      <section className="forum-intro">
        <div className="forum-hero">
          <div className="forum-banner">
            <img
              src={bannerSrc}
              alt={`${forumData?.name || 'Forum'} banner`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = buildUploadSrc('/uploads/banners/DefaultBanner.jpeg');
              }}
            />
          </div>
          <div className="forum-title-row">
            <h2 className="forum-title">
              {forumData?.name ? forumData.name : `Forum ${forum_id}`}
            </h2>
          </div>
          {Array.isArray(forumData?.tags) && forumData.tags.length > 0 && (
            <div className="chips-row" style={{ marginBottom: 0 }}>
              {forumData.tags.map((tag) => (
                <span key={tag} className="chip tag-chip" style={getTagStyle(tag)}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {forumData?.description && (
            <p className="forum-description">{forumData.description}</p>
          )}
        </div>

        {forumData?.created_by && (
          <div className="meta-quiet forum-meta-row">
            <span>Created by</span>
            <img
              src={buildAvatarSrc(forumData.created_by_avatar_path)}
              alt={`${forumData.created_by_first_name || 'User'} ${forumData.created_by_last_name || ''}`}
              style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = buildAvatarSrc(null);
              }}
            />
            <Link to={`/user/${forumData.created_by}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>
              {forumData.created_by_first_name || 'User'} {forumData.created_by_last_name || ''}
            </Link>
            {forumData.created_at ? <span>· {timeAgo(forumData.created_at)}</span> : null}
          </div>
        )}
      </section>

      <div className="forum-browse-controls section-controls filter-toolbar filter-toolbar--filter-first">
        <div className="control-group">
          <span className="sort-pill">Tags</span>
          <div className="forum-tag-filter">
            <div className="topic-dropdown">
              <button
                type="button"
                className={`topic-dropdown-toggle${showTagFilter ? ' open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={showTagFilter}
                onClick={() => setShowTagFilter((prev) => !prev)}
              >
                <span className="topic-dropdown-label">{activeTagLabel}</span>
              </button>
              {showTagFilter && (
                <div className="topic-dropdown-menu" role="listbox" aria-multiselectable="true">
                  <button
                    type="button"
                    className="topic-dropdown-option"
                    role="option"
                    aria-selected={activeTags.length === 0}
                    onClick={() => {
                      handleTagSelect({ target: { value: '' } });
                    }}
                  >
                    <input type="checkbox" readOnly checked={activeTags.length === 0} />
                    All tags
                  </button>
                  {(tagOptions || []).map((opt) => (
                    <button
                      key={opt.slug}
                      type="button"
                      className="topic-dropdown-option"
                      role="option"
                      aria-selected={activeTags.includes(opt.slug)}
                      onClick={() => {
                        handleTagSelect({ target: { value: opt.slug } });
                      }}
                    >
                      <input type="checkbox" readOnly checked={activeTags.includes(opt.slug)} />
                      {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="sort-by" className="sort-pill">Sort</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="mostRecent">Most Recent</option>
            <option value="popularity">Popularity</option>
            <option value="mostUpvoted">Most Upvoted</option>
          </select>
        </div>
        {canCreateThread && (
          <div className="control-action">
            <button
              type="button"
              className="pill-button toolbar-primary-action"
              onClick={() => setShowCreateThreadModal(true)}
            >
              + New Thread
            </button>
          </div>
        )}
      </div>

      {/* Thread list */}
      {sortedThreads.length === 0 ? (
        <p>{activeTags.length ? 'No threads match these tags.' : 'No threads available.'}</p>
      ) : (
        <div className="forum-list">
          {sortedThreads.map((thread) => {
            const isSaved = isThreadSaved(thread.thread_id);
            return (
            <ThreadCard
              key={thread.thread_id}
              thread={{ ...thread, saved: isSaved }}
              userData={userData}
              onUpvote={handleUpvoteClick}
              onDownvote={handleDownvoteClick}
              onEdit={startEditingThread}
              onDelete={handleDeleteThread}
              onToggleSave={() => handleToggleSaveThread(thread.thread_id)}
              onReport={() =>
                handleOpenReport({
                  id: thread.thread_id,
                  type: 'thread',
                  label: thread.title || 'thread',
                  context: stripHtml(thread.title || ''),
                })
              }
              linkTo={`/info/forum/${forum_id}/thread/${thread.thread_id}`}
            />
            );
          })}
        </div>
      )}

      {/* CREATE THREAD MODAL */}
      {canCreateThread && showCreateThreadModal && (
        <ModalOverlay
          isOpen={showCreateThreadModal}
          onClose={handleDismissCreateThreadModal}
        >
          <div className="creation-modal">
            <div className="creation-modal__form">
              <div className="creation-modal__header">
                <div>
                  <p className="creation-modal__meta">
                    {forumData?.name ? forumData.name : `Forum ${forum_id}`}
                  </p>
                  <h3 className="creation-modal__title">Create a new thread</h3>
                  <p className="creation-modal__sub">
                    Set the tone with a sharp title and a first post that spells out what you need.
                  </p>
                  <ul className="creation-points">
                    <li>Lead with a clear, specific title</li>
                    <li>Add the background readers need to respond fast</li>
                    <li>Highlight what kind of replies you&apos;re looking for</li>
                  </ul>
                </div>
              </div>
              <form className="creation-fields" onSubmit={handleCreateThreadSubmit}>
                <div className="creation-field">
                  <label htmlFor="thread-title">Thread title</label>
                  <input
                    type="text"
                    id="thread-title"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="creation-field">
                  <label>First post</label>
                  <TextEditor
                    value={firstPostContent}
                    onChange={(content) => setFirstPostContent(content)}
                  />
                </div>
                <div className="creation-field">
                  <TagPicker
                    label="Tags"
                    options={tagOptions}
                    value={threadTags}
                    onChange={setThreadTags}
                    max={5}
                    helperText="Add up to 5 tags to help others find this thread."
                  />
                </div>
                <div className="creation-actions">
                  <button
                    type="button"
                    className="creation-ghost"
                    onClick={handleDismissCreateThreadModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="creation-primary"
                    disabled={isCreatingThread}
                  >
                    {isCreatingThread ? 'Publishing...' : 'Publish thread'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* EDIT THREAD MODAL */}
      {isEditingThread && (
        <div className="modal-overlay edit-thread-overlay">
          <div className="modal-content edit-thread-modal">
            <h3>Edit Thread Title</h3>
            <form onSubmit={handleEditThreadSubmit}>
              <div className="form-group">
                <label htmlFor="edit-thread-title">Thread Title:</label>
                <input
                  type="text"
                  id="edit-thread-title"
                  value={editThreadTitle}
                  onChange={(e) => setEditThreadTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <TagPicker
                  label="Tags"
                  options={tagOptions}
                  value={editThreadTags}
                  onChange={setEditThreadTags}
                  max={5}
                  helperText="Update the tags for this thread."
                />
              </div>
              <div className="form-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={cancelEditingThread}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
        submitting={isSubmittingReport}
      />

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button
            className="notification-close"
            onClick={() => setNotification(null)}
            aria-label="Close Notification"
          >
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default ForumView;
