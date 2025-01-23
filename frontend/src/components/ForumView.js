// src/components/ForumView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ForumView({ userData }) {
  const { forum_id } = useParams();

  // Forum details
  const [forumData, setForumData] = useState(null);

  // Threads in this forum
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for creating a new thread (including first post)
  const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [firstPostContent, setFirstPostContent] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Thread editing states
  const [editThreadId, setEditThreadId] = useState(null); // Which thread is being edited
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [isEditingThread, setIsEditingThread] = useState(false);

  // Optional notification state
  const [notification, setNotification] = useState(null);

  /**
   * Fetch the forum details (name, description, etc.).
   */
  useEffect(() => {
    const fetchForumDetails = async () => {
      try {
        const response = await axios.get(`/api/fetch_forum.php?forum_id=${forum_id}`);
        setForumData(response.data);
      } catch (error) {
        console.error('Error fetching forum details:', error);
        setForumData(null);
      }
    };
    fetchForumDetails();
  }, [forum_id]);

  /**
   * Fetch threads belonging to this forum.
   */
  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/fetch_threads.php?forum_id=${forum_id}`);
      setThreads(response.data || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Fetching threads for forum_id:', forum_id);
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum_id]);

  /**
   * Handle the submission of a new thread (and its first post).
   */
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
        firstPostContent: firstPostContent
      });

      if (response.data.success) {
        // Reset form fields
        setThreadTitle('');
        setFirstPostContent('');
        setShowCreateThreadModal(false);

        // Refresh thread list
        fetchThreads();

        // Notify user
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

  /**
   * Handle deleting a thread (only if user is thread owner or role_id=3)
   */
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
      setNotification({
        type: 'error',
        message: 'An error occurred while deleting the thread.'
      });
    }
  };

  /**
   * Handle starting thread editing
   */
  const startEditingThread = (thread) => {
    setEditThreadId(thread.thread_id);
    setEditThreadTitle(thread.title);
    setIsEditingThread(true);
  };

  /**
   * Handle canceling thread editing
   */
  const cancelEditingThread = () => {
    setEditThreadId(null);
    setEditThreadTitle('');
    setIsEditingThread(false);
  };

  /**
   * Handle saving edits to a thread's title
   */
  const handleEditThreadSubmit = async (e) => {
    e.preventDefault();
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to edit a thread.' });
      return;
    }
    try {
      const response = await axios.post('/api/edit_thread.php', {
        thread_id: editThreadId,
        new_title: editThreadTitle
      });
      if (response.data.success) {
        // refresh the threads
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
        message: 'An error occurred while editing the thread.'
      });
    } finally {
      // close the edit form
      setIsEditingThread(false);
      setEditThreadId(null);
      setEditThreadTitle('');
    }
  };

  /**
   * JSX Render
   */
  return (
    <div className="feed">
      {/* Back button to the main forum listing ("/info") */}
      <Link to="/info" className="back-button">
        ← Forums
      </Link>
  
      {/* Display the forum title */}
      <h2 className="forum-title">
        {forumData?.name ? forumData.name : `Forum ${forum_id}`}
      </h2>

      {/* If user is logged in, show a "Create Thread" button */}
      {userData && (
        <button
          className="create-button"
          onClick={() => setShowCreateThreadModal(true)}
        >
          Create Thread
        </button>
      )}

      {/* Modal for creating a new thread */}
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
                <textarea
                  id="first-post-content"
                  value={firstPostContent}
                  onChange={(e) => setFirstPostContent(e.target.value)}
                  required
                ></textarea>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isCreatingThread}>
                  {isCreatingThread ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateThreadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* If editing a thread, show inline form or modal */}
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

      {/* Display threads or loading state */}
      {isLoading ? (
        <p>Loading threads...</p>
      ) : threads.length === 0 ? (
        <p>No threads available.</p>
      ) : (
        <div className="forum-list">
          {threads.map((thread) => {
            const canDeleteOrEdit =
              userData &&
              (Number(userData.role_id) === 3 || Number(userData.user_id) === Number(thread.user_id));

            return (
              <div key={thread.thread_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                {/* Thread Title / Info => clickable link to thread detail */}
                <Link
                  to={`/info/forum/${forum_id}/thread/${thread.thread_id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <h3 className="forum-title">{thread.title}</h3>
                  <p className="forum-description">
                    Started by User {thread.user_id} on{' '}
                    {new Date(thread.created_at).toLocaleString()}
                  </p>
                </Link>

                {/* Edit + Delete Buttons => only if user is admin or thread owner */}
                {canDeleteOrEdit && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    {/* Edit Button */}
                    <button
                      style={{
                        backgroundColor: '#ffa500',
                        color: '#fff',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => startEditingThread(thread)}
                    >
                      Edit
                    </button>

                    {/* Delete Button */}
                    <button
                      style={{ 
                        backgroundColor: '#ff6961',
                        color: '#fff',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
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

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button
            className="notification-close"
            onClick={() => setNotification(null)}
          >
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default ForumView;
