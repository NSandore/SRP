// src/components/ThreadView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown,
} from 'react-icons/fa'; // must be at the top

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
 * Renders a single post + replies recursively
 */
function PostItem({
  post,
  userData,
  onReplySubmit,
  expandedReplyBox,
  setExpandedReplyBox,
  handleDeletePost,
  handleEditPost,
  handleUpvoteClick,
  handleDownvoteClick,
  isRoot = false
}) {
  // State for creating replies
  const [localReply, setLocalReply] = useState('');

  // Editing state (for the root post)
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // Check user permissions
  let canDelete = false;
  let canEdit = false;

  if (userData) {
    const roleNum = Number(userData.role_id);
    const userIdNum = Number(userData.user_id);
    const postOwnerId = Number(post.user_id);

    canDelete = (roleNum === 3) || (userIdNum === postOwnerId);
    // We only allow editing on the root post if canDelete
    canEdit = isRoot && canDelete;
  }

  const handleLocalReplyChange = (e) => {
    setLocalReply(e.target.value);
  };

  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (!localReply.trim()) return;
    onReplySubmit(post.post_id, localReply);
    setLocalReply('');
    if (!isRoot) {
      setExpandedReplyBox(null);
    }
  };

  const handleToggleChildReply = () => {
    setExpandedReplyBox(expandedReplyBox === post.post_id ? null : post.post_id);
  };

  const isReplyBoxOpen = isRoot || (expandedReplyBox === post.post_id);

  // Edit Logic
  const startEditing = () => {
    setIsEditing(true);
    setEditContent(post.content);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent(post.content);
  };

  const confirmEdit = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    const success = await handleEditPost(post.post_id, editContent);
    if (success) {
      setIsEditing(false);
    }
  };

  // Decide which icons to show for up/down
  const hasUpvoted = post.user_vote === 'up';
  const hasDownvoted = post.user_vote === 'down';

  const upvoteIcon = hasUpvoted
    ? <FaArrowAltCircleUp style={{ color: 'green', cursor: 'pointer' }} />
    : <FaRegArrowAltCircleUp style={{ cursor: 'pointer' }} />;

  const downvoteIcon = hasDownvoted
    ? <FaArrowAltCircleDown style={{ color: 'red', cursor: 'pointer' }} />
    : <FaRegArrowAltCircleDown style={{ cursor: 'pointer' }} />;

  return (
    <div className="forum-card reply-card">
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
          <div
            className="forum-description"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <small>
            Posted by User {post.user_id} on {new Date(post.created_at).toLocaleString()}
          </small>

          {/* Upvote/Downvote row */}
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span onClick={() => handleUpvoteClick(post.post_id)}>
              {upvoteIcon}
            </span>
            <span>{post.upvotes}</span>
            <span onClick={() => handleDownvoteClick(post.post_id)}>
              {downvoteIcon}
            </span>
            <span>{post.downvotes}</span>
          </div>
        </>
      )}

      {/* Edit + Delete buttons */}
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

      {/* Root post => always show reply field if logged in. 
          Child => toggles. */}
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
                  <button type="submit" className="create-button" style={{ padding: '0.4rem 1rem' }}>
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
              handleUpvoteClick={handleUpvoteClick}
              handleDownvoteClick={handleDownvoteClick}
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

  const [threadData, setThreadData] = useState(null);
  const [postTree, setPostTree] = useState([]);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [notification, setNotification] = useState(null);
  const [expandedReplyBox, setExpandedReplyBox] = useState(null);

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

  // Include user_id if user is logged in
  // Example in ThreadView.js
  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      let url = `/api/fetch_posts.php?thread_id=${thread_id}`;
      if (userData?.user_id) {
        // Append user_id so the backend can do LEFT JOIN post_votes
        url += `&user_id=${userData.user_id}`;
      }
      const res = await axios.get(url);
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
    if (userData && userData.user_id) {
      fetchPosts();
    }
  }, [userData, thread_id]);
  

  // Create new reply
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

  // Delete a post
  const handleDeletePost = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a post.' });
      return;
    }
    try {
      await axios.post('/api/delete_post.php', { post_id });
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

  // Edit the root post
  const handleEditPost = async (post_id, newContent) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to edit a post.' });
      return false;
    }
    try {
      const response = await axios.post('/api/edit_post.php', {
        post_id,
        content: newContent
      });
      if (response.data.success) {
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

  // Upvote a post
  const handleUpvoteClick = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to upvote.' });
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'up'
      });
      fetchPosts();
    } catch (error) {
      console.error('Error upvoting post:', error);
      setNotification({ type: 'error', message: 'Error upvoting post.' });
    }
  };

  // Downvote a post
  const handleDownvoteClick = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to downvote.' });
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'down'
      });
      fetchPosts();
    } catch (error) {
      console.error('Error downvoting post:', error);
      setNotification({ type: 'error', message: 'Error downvoting post.' });
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
              handleEditPost={handleEditPost}
              handleUpvoteClick={handleUpvoteClick}
              handleDownvoteClick={handleDownvoteClick}
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
