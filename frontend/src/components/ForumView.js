// src/components/ForumView.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import TextEditor from './TextEditor';
import './ForumView.css';  // Adjusted to match feed styling
import useOnClickOutside from '../hooks/useOnClickOutside';
import {
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';

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

function ForumView({ userData }) {
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

  // 3-dot menu
  const [openMenuThreadId, setOpenMenuThreadId] = useState(null);
  const menuRef = useRef(null);

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

  // Sort threads
  const sortedThreads = sortItems(threads, sortBy);

  // === 3-dot menu handling ===
  useOnClickOutside(menuRef, () => setOpenMenuThreadId(null));

  const toggleMenu = (threadId) => {
    setOpenMenuThreadId((prev) => (prev === threadId ? null : threadId));
  };

  // === Thread CRUD / Voting ===
  const handleToggleSaveThread = async (threadId) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to save threads.' });
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
    setOpenMenuThreadId(null);
  };

  const handleUpvoteClick = async (threadId) => {
    if (!userData) return alert('You must be logged in to vote.');
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
    if (!userData) return alert('You must be logged in to vote.');
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
      setNotification({ type: 'error', message: 'You must be logged in to create threads.' });
      return;
    }
    setIsCreatingThread(true);
    try {
      const resp = await axios.post('/api/create_thread.php', {
        forum_id: Number(forum_id),
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

  const handleDeleteThread = async (threadId) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a thread.' });
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
      setNotification({ type: 'error', message: 'You must be logged in to edit a thread.' });
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

  return (
    <div className="feed-container forum-view">
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

      {/* Right side: "Create Thread" button (if logged in) */}
      {userData && (
        <button className="create-button" onClick={() => setShowCreateThreadModal(true)}>
          + New Thread
        </button>
      )}
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
          {sortedThreads.map((thread) => {
            const hasUpvoted = thread.vote_type === 'up';
            const hasDownvoted = thread.vote_type === 'down';

            const canEditOrDelete =
              userData &&
              (Number(userData.role_id) === 7 || Number(userData.user_id) === Number(thread.user_id));

            return (
              <div key={thread.thread_id} className="forum-card" style={{ position: 'relative' }}>
                {/* 3-dot menu */}
                <FaEllipsisV
                  className="menu-icon"
                  style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
                  onClick={() => toggleMenu(thread.thread_id)}
                />
                {openMenuThreadId === thread.thread_id && (
                  <div
                    ref={menuRef}
                    className="dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '30px',
                      right: '8px',
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      zIndex: 10,
                      width: '120px',
                    }}
                  >
                    {userData && (
                      <button
                        className="dropdown-item"
                        style={{ padding: '8px', textAlign: 'left', cursor: 'pointer' }}
                        onClick={() => handleToggleSaveThread(thread.thread_id)}
                      >
                        {isThreadSaved(thread.thread_id) ? 'Unsave' : 'Save'}
                      </button>
                    )}
                    <button
                      className="dropdown-item"
                      style={{ padding: '8px', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => {
                        alert(`Report thread ${thread.thread_id}`);
                        setOpenMenuThreadId(null);
                      }}
                    >
                      Report
                    </button>
                  </div>
                )}

                {/* Thread link */}
                <Link
                  to={`/info/forum/${forum_id}/thread/${thread.thread_id}`}
                  className="thread-link"
                >
                  <h3 className="thread-title">{thread.title}</h3>
                  <p className="thread-post-count">
                    {thread.post_count || 0} Posts
                  </p>
                  <p className="thread-description">
                    Started by User {thread.user_id} on{' '}
                    {new Date(thread.created_at).toLocaleString()}
                  </p>
                </Link>

                {/* Voting row */}
                <div className="vote-row">
                  <button
                    type="button"
                    className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
                    title="Upvote"
                    onClick={() => handleUpvoteClick(thread.thread_id)}
                  >
                    {hasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
                  </button>
                  <span className="vote-count">{thread.upvotes}</span>

                  <button
                    type="button"
                    className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
                    title="Downvote"
                    onClick={() => handleDownvoteClick(thread.thread_id)}
                  >
                    {hasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
                  </button>
                  <span className="vote-count">{thread.downvotes}</span>
                </div>

                {/* Edit / Delete buttons */}
                {canEditOrDelete && (
                  <div className="thread-actions">
                    <button
                      className="create-button edit-button"
                      onClick={() => startEditingThread(thread)}
                    >
                      Edit
                    </button>
                    <button
                      className="create-button delete-button"
                      onClick={() => handleDeleteThread(thread.thread_id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE THREAD MODAL */}
      {showCreateThreadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create a New Thread</h3>
            <form onSubmit={handleCreateThreadSubmit}>
              <div className="form-group">
                <label htmlFor="thread-title">Thread Title:</label>
                <input
                  type="text"
                  id="thread-title"
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>First Post Content:</label>
                <TextEditor
                  value={firstPostContent}
                  onChange={(content) => setFirstPostContent(content)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isCreatingThread}>
                  {isCreatingThread ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateThreadModal(false);
                    setThreadTitle('');
                    setFirstPostContent('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
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
