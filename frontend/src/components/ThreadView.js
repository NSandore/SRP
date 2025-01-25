// src/components/ThreadView.js

import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown,
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaListUl,
  FaListOl,
  FaHeading,
  FaLink,
  FaImage,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
} from 'react-icons/fa';

// Tiptap imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// Additional Tiptap Extensions
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';

// For sanitizing HTML
import DOMPurify from 'dompurify';

// For the reply icon
import { FiMessageCircle } from 'react-icons/fi';

/* --------------------------------------------------------------------------
   Toolbar for editing posts
   Matches the functionality from your TextEditor.js
-------------------------------------------------------------------------- */
function EditToolbar({ editor }) {
  if (!editor) return null;

  // Helper for checking active marks/nodes
  const isActive = (type, attrs = {}) => editor.isActive(type, attrs);

  // Single button click handler (like in TextEditor.js)
  const handleButtonClick = (command, value = null) => {
    switch (command) {
      case 'toggleBold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'toggleItalic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'toggleUnderline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'toggleStrike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'toggleBulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'toggleOrderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'toggleHeading':
        editor.chain().focus().toggleHeading({ level: value }).run();
        break;
      case 'addLink': {
        const url = prompt('Enter the URL');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      }
      case 'unlink':
        editor.chain().focus().unsetLink().run();
        break;
      case 'addImage': {
        const imageUrl = prompt('Enter the image URL');
        if (imageUrl) {
          editor.chain().focus().setImage({ src: imageUrl }).run();
        }
        break;
      }
      case 'alignLeft':
        editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        editor.chain().focus().setTextAlign('right').run();
        break;
      default:
        break;
    }
  };

  return (
    <div className="toolbar">
      {/* Bold */}
      <button
        type="button"
        className={`toolbar-button ${isActive('bold') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleBold')}
        title="Bold"
      >
        <FaBold />
      </button>

      {/* Italic */}
      <button
        type="button"
        className={`toolbar-button ${isActive('italic') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleItalic')}
        title="Italic"
      >
        <FaItalic />
      </button>

      {/* Underline */}
      <button
        type="button"
        className={`toolbar-button ${isActive('underline') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleUnderline')}
        title="Underline"
      >
        <FaUnderline />
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        className={`toolbar-button ${isActive('strike') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleStrike')}
        title="Strikethrough"
      >
        <FaStrikethrough />
      </button>

      {/* Bullet List */}
      <button
        type="button"
        className={`toolbar-button ${isActive('bulletList') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleBulletList')}
        title="Bullet List"
      >
        <FaListUl />
      </button>

      {/* Ordered List */}
      <button
        type="button"
        className={`toolbar-button ${isActive('orderedList') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleOrderedList')}
        title="Ordered List"
      >
        <FaListOl />
      </button>

      {/* Headings */}
      <select
        className="toolbar-select"
        onChange={(e) => handleButtonClick('toggleHeading', parseInt(e.target.value))}
        value={
          isActive('heading', { level: 1 })
            ? '1'
            : isActive('heading', { level: 2 })
            ? '2'
            : isActive('heading', { level: 3 })
            ? '3'
            : '0'
        }
        title="Headings"
      >
        <option value="0">Normal</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      {/* Add Link */}
      <button
        type="button"
        className={`toolbar-button ${isActive('link') ? 'active' : ''}`}
        onClick={() => handleButtonClick('addLink')}
        title="Add Link"
      >
        <FaLink />
      </button>

      {/* Unlink */}
      {isActive('link') && (
        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('unlink')}
          title="Remove Link"
        >
          ❌
        </button>
      )}

      {/* Add Image */}
      <button
        type="button"
        className="toolbar-button"
        onClick={() => handleButtonClick('addImage')}
        title="Add Image"
      >
        <FaImage />
      </button>

      {/* Text Alignment Buttons */}
      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'left' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignLeft')}
        title="Align Left"
      >
        <FaAlignLeft />
      </button>

      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'center' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignCenter')}
        title="Align Center"
      >
        <FaAlignCenter />
      </button>

      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'right' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignRight')}
        title="Align Right"
      >
        <FaAlignRight />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Build the nested tree of posts
-------------------------------------------------------------------------- */
function buildReplyTree(posts) {
  const map = {};
  posts.forEach((p) => {
    map[p.post_id] = { ...p, children: [] };
  });

  const roots = [];
  posts.forEach((p) => {
    if (p.reply_to) {
      if (map[p.reply_to]) {
        map[p.reply_to].children.push(map[p.post_id]);
      } else {
        roots.push(map[p.post_id]);
      }
    } else {
      roots.push(map[p.post_id]);
    }
  });

  return roots;
}

/* --------------------------------------------------------------------------
   PostItem Component
-------------------------------------------------------------------------- */
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
  isRoot = false,
}) {
  const [localReply, setLocalReply] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Tiptap editor with same config as TextEditor.js
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: post.content || '',
    editable: isEditing,
  });

  // Cleanup the editor when editing finishes
  useEffect(() => {
    if (!isEditing && editor) {
      editor.destroy();
    }
  }, [isEditing, editor]);

  // Check user permissions
  let canDelete = false;
  let canEdit = false;
  if (userData) {
    const roleNum = Number(userData.role_id);
    const userIdNum = Number(userData.user_id);
    const postOwnerId = Number(post.user_id);

    canDelete = roleNum === 3 || userIdNum === postOwnerId;
    // Only allow editing the root post if user is either admin or post owner
    canEdit = isRoot && canDelete;
  }

  // REPLY Logic
  const handleLocalReplyChange = (e) => setLocalReply(e.target.value);

  const handleReplySubmitLocal = (e) => {
    e.preventDefault();
    if (!localReply.trim()) return;
    onReplySubmit(post.post_id, localReply);
    setLocalReply('');
    if (!isRoot) {
      setExpandedReplyBox(null);
    }
  };

  const isReplyBoxOpen = isRoot || expandedReplyBox === post.post_id;
  const handleToggleChildReply = () => {
    setExpandedReplyBox(isReplyBoxOpen ? null : post.post_id);
  };

  // EDIT Logic
  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const confirmEdit = async (e) => {
    e.preventDefault();
    if (!editor) return;

    const newContent = editor.getHTML();
    if (!newContent.trim()) return;

    // Sanitize to prevent XSS
    const sanitizedContent = DOMPurify.sanitize(newContent);
    const success = await handleEditPost(post.post_id, sanitizedContent);
    if (success) {
      setIsEditing(false);
    }
  };

  // Upvote/Downvote icons
  const hasUpvoted = post.user_vote === 'up';
  const hasDownvoted = post.user_vote === 'down';

  const upvoteIcon = hasUpvoted ? (
    <FaArrowAltCircleUp style={{ color: 'green', cursor: 'pointer' }} />
  ) : (
    <FaRegArrowAltCircleUp style={{ cursor: 'pointer' }} />
  );
  const downvoteIcon = hasDownvoted ? (
    <FaArrowAltCircleDown style={{ color: 'red', cursor: 'pointer' }} />
  ) : (
    <FaRegArrowAltCircleDown style={{ cursor: 'pointer' }} />
  );

  return (
    <div className="forum-card reply-card">
      {isEditing ? (
        <form onSubmit={confirmEdit} style={{ marginBottom: '1rem' }}>
          {/* Show the same toolbar from TextEditor.js */}
          <EditToolbar editor={editor} />
          {/* Editor content */}
          <EditorContent editor={editor} className="tiptap-editor" />

          <div className="edit-form-actions" style={{ marginTop: '0.5rem' }}>
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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
          />
          <small>
            Posted by User {post.user_id} on{' '}
            {new Date(post.created_at).toLocaleString()}
          </small>

          {/* Upvote/Downvote row */}
          <div className="vote-row">
            <span onClick={() => handleUpvoteClick(post.post_id)}>{upvoteIcon}</span>
            <span>{post.upvotes}</span>
            <span onClick={() => handleDownvoteClick(post.post_id)}>{downvoteIcon}</span>
            <span>{post.downvotes}</span>
          </div>
        </>
      )}

      {/* Edit + Delete buttons */}
      <div className="post-actions" style={{ marginTop: '0.5rem' }}>
        {canEdit && !isEditing && (
          <button className="create-button edit-button" onClick={startEditing}>
            Edit
          </button>
        )}
        {canDelete && (
          <button
            className="create-button delete-button"
            onClick={() => handleDeletePost(post.post_id)}
          >
            Delete
          </button>
        )}
      </div>

      {/* If root => show inline reply if logged in, else child => toggle */}
      {isRoot ? (
        userData?.user_id && !isEditing && (
          <form onSubmit={handleReplySubmitLocal} className="reply-form" style={{ marginTop: '1rem' }}>
            <textarea
              placeholder="Reply to this post..."
              value={localReply}
              onChange={handleLocalReplyChange}
              rows={2}
              required
              className="reply-textarea"
            />
            <button type="submit" className="create-button reply-button">
              Reply
            </button>
          </form>
        )
      ) : (
        userData?.user_id && !isEditing && (
          <div className="child-reply-section" style={{ marginTop: '1rem' }}>
            {!isReplyBoxOpen && (
              <span className="reply-toggle" onClick={handleToggleChildReply}>
                <FiMessageCircle />
                <span className="reply-toggle-text">Reply</span>
              </span>
            )}
            {isReplyBoxOpen && (
              <form onSubmit={handleReplySubmitLocal} className="reply-form">
                <textarea
                  placeholder="Reply to this post..."
                  value={localReply}
                  onChange={handleLocalReplyChange}
                  rows={2}
                  required
                  className="reply-textarea"
                />
                <div className="reply-form-actions">
                  <button type="submit" className="create-button reply-button">
                    Submit
                  </button>
                  <button
                    type="button"
                    className="create-button cancel-button"
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

/* --------------------------------------------------------------------------
   Main ThreadView Component
-------------------------------------------------------------------------- */
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
        setNotification({ type: 'error', message: 'Failed to load thread details.' });
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
      let url = `/api/fetch_posts.php?thread_id=${thread_id}`;
      if (userData?.user_id) {
        // Append user_id for the post_votes LEFT JOIN
        url += `&user_id=${userData.user_id}`;
      }
      const res = await axios.get(url);
      const data = Array.isArray(res.data) ? res.data : [];
      const tree = buildReplyTree(data);
      setPostTree(tree);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setPostTree([]);
      setNotification({ type: 'error', message: 'Failed to load posts.' });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, thread_id]);

  // handleReplySubmit for new replies
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
        reply_to: reply_to_post_id,
      });
      fetchPosts();
      setExpandedReplyBox(null);
      setNotification({ type: 'success', message: 'Reply created successfully.' });
    } catch (error) {
      console.error('Error creating reply:', error);
      setNotification({ type: 'error', message: 'An error occurred while creating the reply.' });
    }
  };

  // handleDeletePost
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
      setNotification({ type: 'error', message: 'An error occurred while deleting the post.' });
    }
  };

  // handleEditPost for root post editing
  const handleEditPost = async (post_id, newContent) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to edit a post.' });
      return false;
    }
    try {
      const response = await axios.post('/api/edit_post.php', {
        post_id,
        content: newContent,
      });
      if (response.data.success) {
        fetchPosts();
        setNotification({ type: 'success', message: 'Post updated successfully.' });
        return true;
      } else {
        setNotification({
          type: 'error',
          message: response.data.error || response.data.message,
        });
        return false;
      }
    } catch (error) {
      console.error('Error editing post:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while editing the post.',
      });
      return false;
    }
  };

  // Upvote
  const handleUpvoteClick = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to upvote.' });
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'up',
      });
      fetchPosts();
    } catch (error) {
      console.error('Error upvoting post:', error);
      setNotification({ type: 'error', message: 'Error upvoting post.' });
    }
  };

  // Downvote
  const handleDownvoteClick = async (post_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to downvote.' });
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'down',
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
      {/* Back button */}
      <RouterLink to={`/info/forum/${threadData?.forum_id || ''}`} className="back-button">
        ← {threadData?.forum_name || 'Forum'}
      </RouterLink>

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

export default ThreadView;
