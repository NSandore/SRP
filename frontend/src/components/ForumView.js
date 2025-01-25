// src/components/ForumView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import TextEditor from './TextEditor'; // Import the TipTap editor component
import './ForumView.css'; // Import your CSS for styling

function ForumView({ userData }) {
  const { forum_id } = useParams();

  // **State Management**

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
  const [editThreadId, setEditThreadId] = useState(null); // ID of thread being edited
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [isEditingThread, setIsEditingThread] = useState(false);

  // Notification state
  const [notification, setNotification] = useState(null);

  /**
   * **Fetch Forum Details**
   * Retrieves details about the current forum based on `forum_id`.
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
   * **Fetch Threads**
   * Retrieves all threads associated with the current forum.
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

  // Fetch threads on component mount and when `forum_id` changes
  useEffect(() => {
    console.log('Fetching threads for forum_id:', forum_id);
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum_id]);

  /**
   * **Handle Create Thread Submission**
   * Submits a new thread along with its first post content to the backend.
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
        firstPostContent: firstPostContent, // TipTap HTML content
      });

      if (response.data.success) {
        // Reset form fields
        setThreadTitle('');
        setFirstPostContent('');
        setShowCreateThreadModal(false);

        // Refresh thread list
        fetchThreads();

        // Notify user of success
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
   * **Handle Delete Thread**
   * Deletes a thread if the user is authorized (owner or admin).
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
        message: 'An error occurred while deleting the thread.',
      });
    }
  };

  /**
   * **Start Editing Thread**
   * Initializes the editing state for a specific thread.
   */
  const startEditingThread = (thread) => {
    setEditThreadId(thread.thread_id);
    setEditThreadTitle(thread.title);
    setIsEditingThread(true);
  };

  /**
   * **Cancel Editing Thread**
   * Resets the editing state.
   */
  const cancelEditingThread = () => {
    setEditThreadId(null);
    setEditThreadTitle('');
    setIsEditingThread(false);
  };

  /**
   * **Handle Edit Thread Submission**
   * Submits the edited thread title to the backend.
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
        new_title: editThreadTitle,
      });
      if (response.data.success) {
        // Refresh the threads
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
      // Close the edit form
      setIsEditingThread(false);
      setEditThreadId(null);
      setEditThreadTitle('');
    }
  };

  /**
   * **JSX Render**
   */
  return (
    <div className="forum-view">
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
              {/* Thread Title Input */}
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

              {/* First Post Content (TipTap Editor) */}
              <div className="form-group">
                <label htmlFor="first-post-content">First Post Content:</label>
                <TextEditor
                  value={firstPostContent}
                  onChange={(content) => setFirstPostContent(content)}
                />
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button type="submit" disabled={isCreatingThread}>
                  {isCreatingThread ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateThreadModal(false);
                    setThreadTitle('');
                    setFirstPostContent(''); // Reset editor content
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for editing a thread title */}
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
              (Number(userData.role_id) === 3 ||
                Number(userData.user_id) === Number(thread.user_id));

            return (
              <div key={thread.thread_id} className="forum-card">
                {/* Thread Title / Info => clickable link to thread detail */}
                <Link
                  to={`/info/forum/${forum_id}/thread/${thread.thread_id}`}
                  className="thread-link"
                >
                  <h3 className="thread-title">{thread.title}</h3>
                  <p className="thread-description">
                    Started by User {thread.user_id} on{' '}
                    {new Date(thread.created_at).toLocaleString()}
                  </p>
                </Link>

                {/* Edit + Delete Buttons => only if user is admin or thread owner */}
                {canDeleteOrEdit && (
                  <div className="thread-actions">
                    {/* Edit Button */}
                    <button
                      className="edit-button"
                      onClick={() => startEditingThread(thread)}
                    >
                      Edit
                    </button>

                    {/* Delete Button */}
                    <button
                      className="delete-button"
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
