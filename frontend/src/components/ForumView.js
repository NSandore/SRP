// src/components/ForumView.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import TextEditor from './TextEditor';
import './ForumView.css';  // Adjusted to match feed styling
import './CreationModal.css';
import ModalOverlay from './ModalOverlay';
import { FaEllipsisV, FaArrowAltCircleUp, FaRegArrowAltCircleUp, FaArrowAltCircleDown, FaRegArrowAltCircleDown } from 'react-icons/fa';
import ThreadCard from './ThreadCard';
import ReportModal from './ReportModal';

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

function ForumView({ userData, onRequireAuth }) {
  const { forum_id } = useParams();

  // Forum data & threads
  const [forumData, setForumData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting
  const [sortBy, setSortBy] = useState('mostRecent');

  // Create Thread
  const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [firstPostContent, setFirstPostContent] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Edit Thread
  const [editThreadId, setEditThreadId] = useState(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [isEditingThread, setIsEditingThread] = useState(false);

  // Notification
  const [notification, setNotification] = useState(null);

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
  const sortedThreads = sortItems(threads, sortBy);

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
      });
      if (resp.data.success) {
        setThreadTitle('');
        setFirstPostContent('');
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
        message: 'An error occurred while creating the thread.',
      });
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleDismissCreateThreadModal = () => {
    setShowCreateThreadModal(false);
    setThreadTitle('');
    setFirstPostContent('');
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
    setEditThreadTitle(thread.title);
    setIsEditingThread(true);
  };

  const cancelEditingThread = () => {
    setEditThreadId(null);
    setEditThreadTitle('');
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
      <div className="feed-container forum-view">
        <p>Loading threads...</p>
      </div>
    );
  }

  const isAdmin = Number(userData?.role_id) === 1;
  const isAmbassador = Number(userData?.is_ambassador) === 1;
  const communityId = forumData?.community_id;
  const ambassadorHasAccess =
    isAmbassador &&
    communityId &&
    ambassadorCommunities.some((c) => {
      const id = c?.community_id ?? c?.id ?? c;
      return Number(id) === Number(communityId);
    });
  const canCreateThread = Boolean(userData && (isAdmin || ambassadorHasAccess));

  return (
    <div className="feed-container forum-view">
    {/* Breadcrumbs */}
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/info">Info Board</Link>
      <span className="breadcrumb-sep">&gt;</span>
      {/*<span className="breadcrumb-current" aria-current="page">
        {forumData?.name ? forumData.name : `Forum ${forum_id}`}
      </span>*/}
    </nav>
    {/* Top Header Row */}
    <div
      className="feed-header"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1.1vh', paddingBottom: '1.7rem' }}
    >
      {/* Left side: arrow + forum title in one flex row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link to="/info" className="arrow-link">
          ←
        </Link>
        <h2 className="forum-title">
          {forumData?.name ? forumData.name : `Forum ${forum_id}`}
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="pill-button ghost"
          onClick={() =>
            handleOpenReport({
              id: forum_id,
              type: 'forum',
              label: forumData?.name || 'forum',
              context: stripHtml(forumData?.description || '').slice(0, 200),
            })
          }
        >
          Report
        </button>
        {canCreateThread && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateThreadModal(true)}
          >
            New Thread
          </button>
        )}
      </div>
    </div>
    
      {/* Sorting */}
      <div className="sort-container">
        <label htmlFor="sort-by">Sort by:</label>
        <select
          id="sort-by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="mostRecent">Most Recent</option>
          <option value="popularity">Popularity</option>
          <option value="mostUpvoted">Most Upvoted</option>
        </select>
      </div>

      {/* Thread list */}
      {sortedThreads.length === 0 ? (
        <p>No threads available.</p>
      ) : (
        <div className="forum-list">
          {sortedThreads.map((thread) => (
            <ThreadCard
              key={thread.thread_id}
              thread={thread}
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
          ))}
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
        <div className="modal-overlay">
          <div className="modal-content">
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
