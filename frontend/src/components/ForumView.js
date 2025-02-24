// src/components/ForumView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import TextEditor from './TextEditor';
import './ForumView.css';
import useOnClickOutside from '../hooks/useOnClickOutside';
import { 
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';

/**
 * Sorting function for threads
 */
const sortItems = (items, criteria) => {
  const sorted = [...items]; // Copy to avoid mutating state

  if (criteria === "popularity") {
    sorted.sort((a, b) => 
      (parseInt(b.upvotes, 10) + parseInt(b.downvotes, 10)) -
      (parseInt(a.upvotes, 10) + parseInt(a.downvotes, 10))
    );
  } else if (criteria === "mostUpvoted") {
    sorted.sort((a, b) => parseInt(b.upvotes, 10) - parseInt(a.upvotes, 10));
  } else if (criteria === "mostRecent") {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return sorted;
};

/**
 * ThreadCard sub-component:
 * Renders an individual thread card, including the 3-dot menu,
 * and calls hooks (useRef, useOnClickOutside) at the top level.
 */
function ThreadCard({
  thread,
  userData,
  forum_id,
  openMenuThreadId,
  setOpenMenuThreadId,
  toggleMenu,
  menuRef,
  isThreadSaved,
  handleToggleSaveThread,
  handleDeleteThread,
  startEditingThread,
  handleVoteThread,
  handleUpvoteClick={handleUpvoteClick},  // ✅ Add this
  handleDownvoteClick={handleDownvoteClick}  // ✅ Add this
}) {
  // useOnClickOutside hook to close the menu if a click is outside
  useOnClickOutside(menuRef, () => {
    if (openMenuThreadId === thread.thread_id) {
      setOpenMenuThreadId(null);
    }
  });

  // Check user vote status
  const hasUpvoted = thread.vote_type === 'up';
  const hasDownvoted = thread.vote_type === 'down';

  // Check if user can delete/edit
  const canDeleteOrEdit =
    userData &&
    (Number(userData.role_id) === 7 || Number(userData.user_id) === Number(thread.user_id));

  return (
    <div className="forum-card" style={{ position: 'relative' }}>
      {/* 3-dot icon */}
      <FaEllipsisV
        className="menu-icon"
        style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
        onClick={() => toggleMenu(thread.thread_id)}
      />

      {/* Dropdown menu (conditional) */}
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
              style={{
                width: '100%',
                border: 'none',
                background: 'none',
                padding: '8px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onClick={() => handleToggleSaveThread(thread.thread_id)}
            >
              {isThreadSaved(thread.thread_id) ? 'Unsave' : 'Save'}
            </button>
          )}
          <button
            className="dropdown-item"
            style={{
              width: '100%',
              border: 'none',
              background: 'none',
              padding: '8px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
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
      <Link to={`/info/forum/${forum_id}/thread/${thread.thread_id}`} className="thread-link">
        <h3 className="thread-title">{thread.title}</h3>
        <p className="thread-post-count">{thread.post_count || 0} Posts</p>
        <p className="thread-description">
          Started by User {thread.user_id} on {new Date(thread.created_at).toLocaleString()}
        </p>
      </Link>

      {/* Upvote/Downvote Buttons */}
      <div className="vote-row">
        <button
          type="button"
          className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
          onClick={() => handleUpvoteClick(thread.thread_id)}
          title="Upvote"
        >
          {hasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
        </button>
        <span className="vote-count">{thread.upvotes}</span>

        <button
          type="button"
          className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
          onClick={() => handleDownvoteClick(thread.thread_id)}
          title="Downvote"
        >
          {hasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
        </button>
        <span className="vote-count">{thread.downvotes}</span>
      </div>

      {/* Edit / Delete actions */}
      {canDeleteOrEdit && (
        <div className="thread-actions">
          <button className="edit-button" onClick={() => startEditingThread(thread)}>
            Edit
          </button>
          <button className="delete-button" onClick={() => handleDeleteThread(thread.thread_id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Main ForumView component
 */
function ForumView({ userData }) {
  const { forum_id } = useParams();

  // Forum details
  const [forumData, setForumData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for sorting
  const [sortBy, setSortBy] = useState("mostRecent"); // Default to most recent

  // Create thread states
  const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [firstPostContent, setFirstPostContent] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Edit thread states
  const [editThreadId, setEditThreadId] = useState(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [isEditingThread, setIsEditingThread] = useState(false);

  // Notification
  const [notification, setNotification] = useState(null);

  // Saved threads
  const [savedThreads, setSavedThreads] = useState([]);

  // Which thread has an open 3-dot menu
  const [openMenuThreadId, setOpenMenuThreadId] = useState(null);

  // Helper: determine if thread is saved
  const isThreadSaved = (threadId) =>
    savedThreads.some((t) => Number(t.thread_id) === Number(threadId));

  // Toggle 3-dot menu
  const toggleMenu = (threadId) => {
    setOpenMenuThreadId((prev) => (prev === threadId ? null : threadId));
  };

  // Save/un-save a thread
  const handleToggleSaveThread = async (threadId) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to save threads.' });
      return;
    }

    const alreadySaved = isThreadSaved(threadId);
    const url = alreadySaved ? '/api/unsave_thread.php' : '/api/save_thread.php';
    try {
      const resp = await axios.post(
        url,
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
        setNotification({ type: 'error', message: resp.data.error || 'Error saving thread.' });
      }
    } catch (error) {
      console.error('Error saving/unsaving thread:', error);
      setNotification({ type: 'error', message: 'Error saving/unsaving thread.' });
    }
    setOpenMenuThreadId(null);
  };

  // Fetch saved threads
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
  
  // Upvote a thread
  const handleUpvoteClick = async (thread_id) => {
    if (!userData) return alert('You must be logged in to vote.');
    try {
      await axios.post('/api/vote_thread.php', { thread_id, user_id: userData.user_id, vote_type: 'up' });
      fetchThreads();
    } catch (error) {
      console.error('Error upvoting thread:', error);
    }
  };

  // Downvote a thread
  const handleDownvoteClick = async (thread_id) => {
    if (!userData) return alert('You must be logged in to vote.');
    try {
      await axios.post('/api/vote_thread.php', { thread_id, user_id: userData.user_id, vote_type: 'down' });
      fetchThreads();
    } catch (error) {
      console.error('Error downvoting thread:', error);
    }
  };

  // Fetch forum details
  useEffect(() => {
    const fetchForumDetails = async () => {
      try {
        const response = await axios.get(`/api/fetch_forum.php?forum_id=${forum_id}`);
        setForumData(response.data);
      } catch (error) {
        console.error('Error fetching forum details:', error);
        setForumData(null);
        setNotification({ type: 'error', message: 'Failed to load forum details.' });
      }
    };
    fetchForumDetails();
  }, [forum_id]);

  // Fetch threads
  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/fetch_threads.php?forum_id=${forum_id}&user_id=${userData ? userData.user_id : 0}`);
      setThreads(response.data || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
      setThreads([]);
      setNotification({ type: 'error', message: 'Failed to load threads.' });
    } finally {
      setIsLoading(false);
    }
  };  

  // Vote on a thread
  const handleVoteThread = async (thread_id, vote_type) => {
    if (!userData) {
      alert('You must be logged in to vote.');
      return;
    }

    try {
      await axios.post('/api/vote_thread.php', {
        thread_id,
        user_id: userData.user_id,
        vote_type
      });

      fetchThreads();
    } catch (error) {
      console.error('Error voting on thread:', error);
    }
  };
  
  // On mount or when user changes
  useEffect(() => {
    fetchThreads();
    if (userData) {
      fetchSavedThreads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum_id, userData]);

  // Apply sorting
  const sortedThreads = sortItems(threads, sortBy);
  
  // Create new thread
  const handleCreateThreadSubmit = async (e) => {
    e.preventDefault();
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to create threads.' });
      return;
    }

    setIsCreatingThread(true);
    try {
      const response = await axios.post('/api/create_thread.php', {
        forum_id: Number(forum_id),
        user_id: userData.user_id,
        title: threadTitle,
        firstPostContent: firstPostContent,
      });

      if (response.data.success) {
        setThreadTitle('');
        setFirstPostContent('');
        setShowCreateThreadModal(false);
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread created successfully!' });
      } else {
        const errMsg = response.data.error || 'Unknown error creating thread.';
        setNotification({ type: 'error', message: errMsg });
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      setNotification({ type: 'error', message: 'An error occurred while creating the thread.' });
    } finally {
      setIsCreatingThread(false);
    }
  };

  // Delete thread
  const handleDeleteThread = async (thread_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a thread.' });
      return;
    }

    try {
      const response = await axios.post('/api/delete_thread.php', { thread_id });
      if (response.data.success) {
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread deleted successfully.' });
      } else {
        const errMsg = response.data.error || 'Error deleting thread.';
        setNotification({ type: 'error', message: errMsg });
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      setNotification({ type: 'error', message: 'An error occurred while deleting the thread.' });
    }
  };

  // Edit thread
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
      const response = await axios.post('/api/edit_thread.php', {
        thread_id: editThreadId,
        new_title: editThreadTitle,
      });
      if (response.data.success) {
        fetchThreads();
        setNotification({ type: 'success', message: 'Thread updated successfully!' });
      } else {
        const errMsg = response.data.error || 'Error editing thread.';
        setNotification({ type: 'error', message: errMsg });
      }
    } catch (error) {
      console.error('Error editing thread:', error);
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

  return (
    <div className="feed forum-view">
      <Link to="/info" className="back-button">
        ← Forums
      </Link>
      <h2 className="forum-title">{forumData?.name ? forumData.name : `Forum ${forum_id}`}</h2>

      {/* Sort Dropdown */}
      <div className="sort-container" style={{ marginBottom: '1rem' }}>
        <label htmlFor="sort-by">Sort by: </label>
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

      {userData && (
        <button className="create-button" onClick={() => setShowCreateThreadModal(true)}>
          Create Thread
        </button>
      )}

      {/* Create Thread Modal */}
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
                <label htmlFor="first-post-content">First Post Content:</label>
                <TextEditor value={firstPostContent} onChange={(c) => setFirstPostContent(c)} />
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

      {/* Edit Thread Modal */}
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
                <button type="button" onClick={cancelEditingThread}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Display threads */}
      {isLoading ? (
        <p>Loading threads...</p>
      ) : sortedThreads.length === 0 ? (
        <p>No threads available.</p>
      ) : (
        <div className="forum-list">
          {sortedThreads.map((thread) => (
            <div key={thread.thread_id} className="forum-card">
              <Link to={`/info/forum/${forum_id}/thread/${thread.thread_id}`} className="thread-link">
                <h3 className="thread-title">{thread.title}</h3>
                <p className="thread-post-count">{thread.post_count || 0} Posts</p>
                <p className="thread-description">
                  Started by User {thread.user_id} on {new Date(thread.created_at).toLocaleString()}
                </p>
              </Link>
              <div className="vote-row">
                <button
                  type="button"
                  className={`vote-button upvote-button ${thread.vote_type === 'up' ? 'active' : ''}`}
                  title="Upvote"
                >
                  {thread.vote_type === 'up' ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
                </button>
                <span className="vote-count">{thread.upvotes}</span>
                <button
                  type="button"
                  className={`vote-button downvote-button ${thread.vote_type === 'down' ? 'active' : ''}`}
                  title="Downvote"
                >
                  {thread.vote_type === 'down' ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
                </button>
                <span className="vote-count">{thread.downvotes}</span>
              </div>
            </div>
          ))}
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
