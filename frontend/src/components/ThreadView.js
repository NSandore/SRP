// src/components/ThreadView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

/**
 * Utility function to build a nested tree of posts using reply_to.
 */
function buildReplyTree(posts) {
  const map = {};
  // Create a map of post_id -> post object with an empty children array
  posts.forEach((p) => {
    map[p.post_id] = { ...p, children: [] };
  });

  const roots = [];
  posts.forEach((p) => {
    if (p.reply_to) {
      // If this post replies to another, add it to that parent's children array
      map[p.reply_to].children.push(map[p.post_id]);
    } else {
      // If no parent => root-level post
      roots.push(map[p.post_id]);
    }
  });

  return roots;
}

/**
 * Renders a single post. 
 * - Root post (reply_to = null) can have an "Edit" button if user is owner or role=3.
 * - Root post also always has a text area to reply if user is logged in.
 * - Child posts have a "Reply" button that toggles a single text area for that post.
 * - "Delete" button is only shown if the user is the post's owner or role=3.
 */
function PostItem({
  post,
  userData,
  onReplySubmit,
  expandedReplyBox,
  setExpandedReplyBox,
  handleDeletePost,
  handleEditPost,   // new prop for editing
  isRoot = false
}) {
  // State for creating replies
  const [localReply, setLocalReply] = useState('');

  // State to handle editing the **root** post
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // If user is logged in and either role=3 or user_id=owner => can delete
  let canDelete = false;
  // If it's the root post => can edit if same condition above
  let canEdit = false;

  if (userData) {
    const roleNum = Number(userData.role_id);
    const userIdNum = Number(userData.user_id);
    const postOwnerId = Number(post.user_id);

    canDelete = (roleNum === 3) || (userIdNum === postOwnerId);
    // We only allow editing on the root post, and only if canDelete
    // and no reply_to => means it's truly the first post.
    canEdit = isRoot && canDelete;
  }

  // Handle changes in reply text
  const handleLocalReplyChange = (e) => {
    setLocalReply(e.target.value);
  };

  // Submits the reply
  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (!localReply.trim()) return;
    onReplySubmit(post.post_id, localReply);
    setLocalReply('');
    // For child posts, collapse after submission
    if (!isRoot) {
      setExpandedReplyBox(null);
    }
  };

  // Toggle the reply box for child posts
  const handleToggleChildReply = () => {
    setExpandedReplyBox(expandedReplyBox === post.post_id ? null : post.post_id);
  };

  const isReplyBoxOpen = isRoot || (expandedReplyBox === post.post_id);

  // -------------- EDIT LOGIC FOR THE ROOT POST --------------
  // Start editing mode
  const startEditing = () => {
    setIsEditing(true);
    setEditContent(post.content); // load current content
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent(post.content); // revert to original
  };

  // Confirm edit => calls handleEditPost from parent
  const confirmEdit = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    // handleEditPost => calls /api/edit_post.php, etc.
    const success = await handleEditPost(post.post_id, editContent);
    if (success) {
      // If the edit was successful, close editing mode
      setIsEditing(false);
    }
    // If not success, you could handle error state or do nothing
  };

  return (
    <div className="forum-card reply-card">
      {/* If isEditing = true (root post), show an edit text area. 
          Otherwise, show normal post content. */}
      {isEditing ? (
        <form onSubmit={confirmEdit} style={{ marginBottom: '1rem' }}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            style={{ width: '100%', marginBottom: '0.5rem' }}
            required
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="submit" 
              className="create-button" 
              style={{ backgroundColor: '#4CAF50', color: '#fff' }}
            >
              Save
            </button>
            <button
              type="button"
              className="create-button"
              style={{ backgroundColor: '#ccc', color: '#333' }}
              onClick={cancelEditing}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="forum-description">{post.content}</p>
          <small>
            Posted by User {post.user_id} on {new Date(post.created_at).toLocaleString()}
          </small>
          <div style={{ marginTop: '0.5rem' }}>
            <span>Upvotes: {post.upvotes}</span> | <span>Downvotes: {post.downvotes}</span>
          </div>
        </>
      )}

      {/* Edit + Delete buttons (only for root post => canEdit, canDelete) */}
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        {canEdit && !isEditing && (
          <button
            className="create-button"
            style={{ backgroundColor: '#ffa500', color: '#fff' }}
            onClick={startEditing}
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            className="create-button"
            style={{ backgroundColor: '#ff6961', color: '#fff' }}
            onClick={() => handleDeletePost(post.post_id)}
          >
            Delete
          </button>
        )}
      </div>

      {/* For the root post => always show reply text area if user is logged in.
          For child => a "Reply" button that toggles a single text area. */}
      {isRoot ? (
        userData?.user_id && !isEditing && (
          <form onSubmit={handleReplySubmit} style={{ marginTop: '1rem' }}>
            <textarea
              placeholder="Reply to this post..."
              value={localReply}
              onChange={handleLocalReplyChange}
              rows={2}
              required
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <button type="submit" className="create-button" style={{ padding: '0.4rem 1rem' }}>
              Reply
            </button>
          </form>
        )
      ) : (
        // Child posts
        userData?.user_id && !isEditing && (
          <div style={{ marginTop: '1rem' }}>
            {!isReplyBoxOpen && (
              <button
                className="create-button"
                style={{ padding: '0.4rem 1rem' }}
                onClick={handleToggleChildReply}
              >
                Reply
              </button>
            )}
            {isReplyBoxOpen && (
              <form onSubmit={handleReplySubmit}>
                <textarea
                  placeholder="Reply to this post..."
                  value={localReply}
                  onChange={handleLocalReplyChange}
                  rows={2}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    className="create-button"
                    style={{ padding: '0.4rem 1rem' }}
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    className="create-button"
                    style={{ padding: '0.4rem 1rem', backgroundColor: '#ccc', color: '#333' }}
                    onClick={() => setExpandedReplyBox(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )
      )}

      {/* Recursively render child replies */}
      {post.children && post.children.length > 0 && (
        <div className="reply-tree-level">
          {post.children.map((child) => (
            <PostItem
              key={child.post_id}
              post={child}
              userData={userData}
              onReplySubmit={onReplySubmit}
              expandedReplyBox={expandedReplyBox}
              setExpandedReplyBox={setExpandedReplyBox}
              handleDeletePost={handleDeletePost}
              handleEditPost={handleEditPost}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadView({ userData }) {
  const { thread_id } = useParams();

  const [threadData, setThreadData] = useState(null);  // Info about the thread (title, forum_id, etc.)
  const [postTree, setPostTree] = useState([]);        // Nested array of posts
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // Notification / error message
  const [notification, setNotification] = useState(null);

  // Single state to track which child post's reply box is open
  const [expandedReplyBox, setExpandedReplyBox] = useState(null);

  // Fetch the thread details
  useEffect(() => {
    const fetchThread = async () => {
      try {
        const res = await axios.get(`/api/fetch_thread.php?thread_id=${thread_id}`);
        setThreadData(res.data);
      } catch (err) {
        console.error('Error fetching thread details:', err);
      } finally {
        setIsLoadingThread(false);
      }
    };
    fetchThread();
  }, [thread_id]);

  // Build the nested structure of posts
  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const res = await axios.get(`/api/fetch_posts.php?thread_id=${thread_id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      const tree = buildReplyTree(data);
      setPostTree(tree);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setPostTree([]);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread_id]);

  // Called when the user submits a new reply
  const handleReplySubmit = async (reply_to_post_id, content) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to reply.' });
      return;
    }

    try {
      await axios.post('/api/create_reply.php', {
        thread_id: Number(thread_id),
        user_id: userData.user_id,
        content,
        reply_to: reply_to_post_id
      });
      // Refresh posts
      fetchPosts();
      setExpandedReplyBox(null);
    } catch (error) {
      console.error('Error creating reply:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while creating the reply.'
      });
    }
  };

  /**
   * Called when a user attempts to delete a post.
   */
  const handleDeletePost = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a post.' });
      return;
    }

    try {
      // Suppose /api/delete_post.php checks user ownership or role
      await axios.post('/api/delete_post.php', { post_id });
      // Refresh the post list after deletion
      fetchPosts();
      setNotification({ type: 'success', message: 'Post deleted successfully.' });
    } catch (error) {
      console.error('Error deleting post:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while deleting the post.'
      });
    }
  };

  /**
   * Called when a user attempts to edit the root post
   */
  const handleEditPost = async (post_id, newContent) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to edit a post.' });
      return false;
    }

    try {
      // We'll assume /api/edit_post.php checks that it's the root post 
      // and that the user is the owner or role=3
      const response = await axios.post('/api/edit_post.php', {
        post_id,
        content: newContent
      });
      if (response.data.success) {
        // Refresh the post list after editing
        fetchPosts();
        setNotification({ type: 'success', message: 'Post updated successfully.' });
        return true;
      } else {
        setNotification({ type: 'error', message: response.data.error || response.data.message });
        return false;
      }
    } catch (error) {
      console.error('Error editing post:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while editing the post.'
      });
      return false;
    }
  };

  if (isLoadingThread || isLoadingPosts) {
    return <p>Loading thread and posts...</p>;
  }

  return (
    <div className="feed thread-view">
      <Link
        to={`/info/forum/${threadData?.forum_id || ''}`}
        className="back-button"
      >
        ← {threadData?.forum_name || 'Forum'}
      </Link>

      <h2 className="forum-title">
        {threadData?.title || `Thread ${thread_id}`}
      </h2>

      {postTree.length === 0 ? (
        <p>No replies found.</p>
      ) : (
        <div className="forum-list">
          {postTree.map((rootPost) => (
            <PostItem
              key={rootPost.post_id}
              post={rootPost}
              userData={userData}
              onReplySubmit={handleReplySubmit}
              expandedReplyBox={expandedReplyBox}
              setExpandedReplyBox={setExpandedReplyBox}
              handleDeletePost={handleDeletePost}
              handleEditPost={handleEditPost}     // pass down
              isRoot
            />
          ))}
        </div>
      )}

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

export default ThreadView;
