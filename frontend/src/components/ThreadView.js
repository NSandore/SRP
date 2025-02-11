// src/components/ThreadView.js
import './ThreadView.css';
import React, { useRef, useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import useOnClickOutside from '../hooks/useOnClickOutside'; // <--- import the hook
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
  FaChevronDown,
  FaChevronRight,
  FaEllipsisV, // add for 3-dot menu
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
        aria-label="Bold"
      >
        <FaBold />
      </button>

      {/* Italic */}
      <button
        type="button"
        className={`toolbar-button ${isActive('italic') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleItalic')}
        title="Italic"
        aria-label="Italic"
      >
        <FaItalic />
      </button>

      {/* Underline */}
      <button
        type="button"
        className={`toolbar-button ${isActive('underline') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleUnderline')}
        title="Underline"
        aria-label="Underline"
      >
        <FaUnderline />
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        className={`toolbar-button ${isActive('strike') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleStrike')}
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <FaStrikethrough />
      </button>

      {/* Bullet List */}
      <button
        type="button"
        className={`toolbar-button ${isActive('bulletList') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleBulletList')}
        title="Bullet List"
        aria-label="Bullet List"
      >
        <FaListUl />
      </button>

      {/* Ordered List */}
      <button
        type="button"
        className={`toolbar-button ${isActive('orderedList') ? 'active' : ''}`}
        onClick={() => handleButtonClick('toggleOrderedList')}
        title="Ordered List"
        aria-label="Ordered List"
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
        aria-label="Headings"
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
        aria-label="Add Link"
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
          aria-label="Remove Link"
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
        aria-label="Add Image"
      >
        <FaImage />
      </button>

      {/* Text Alignment Buttons */}
      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'left' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignLeft')}
        title="Align Left"
        aria-label="Align Left"
      >
        <FaAlignLeft />
      </button>

      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'center' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignCenter')}
        title="Align Center"
        aria-label="Align Center"
      >
        <FaAlignCenter />
      </button>

      <button
        type="button"
        className={`toolbar-button ${isActive('textAlign', { align: 'right' }) ? 'active' : ''}`}
        onClick={() => handleButtonClick('alignRight')}
        title="Align Right"
        aria-label="Align Right"
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
  level = 1,
  // NEW: for saving posts
  savedPosts,
  handleToggleSavePost,
}) {
  const [localReply, setLocalReply] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(level === 2); // Auto-collapse at level 2

  // 3-dot menu
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  const toggleMenu = () => setOpenMenu((prev) => !prev);

  useOnClickOutside(menuRef, () => {
    if (openMenu) {
      setOpenMenu(false);
    }
  });

  // Check if post is saved
  const isSaved = savedPosts.some((pSaved) => Number(pSaved.post_id) === Number(post.post_id));  

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

  const handleReplySubmitLocal = async (e) => {
    e.preventDefault();
    if (!localReply.trim()) return;
    await onReplySubmit(post.post_id, localReply);
    setLocalReply('');
    setExpandedReplyBox(null);
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
    <FaArrowAltCircleUp />
  ) : (
    <FaRegArrowAltCircleUp />
  );
  const downvoteIcon = hasDownvoted ? (
    <FaArrowAltCircleDown />
  ) : (
    <FaRegArrowAltCircleDown />
  );

  // Determine if the reply box for this post is open
  const isReplyBoxOpen = expandedReplyBox === post.post_id;

  const handleToggleReplyBox = () => {
    if (isReplyBoxOpen) {
      setExpandedReplyBox(null);
    } else {
      setExpandedReplyBox(post.post_id);
    }
  };

  // Toggle collapse of replies
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`forum-card reply-card level-${level}`}>
      {isEditing ? (
        <form onSubmit={confirmEdit} className="edit-form" style={{ marginBottom: '1rem' }}>
          {/* Show the same toolbar from TextEditor.js */}
          <EditToolbar editor={editor} />
          {/* Editor content */}
          <EditorContent editor={editor} className="tiptap-editor" />

          <div className="edit-form-actions">
            <button type="submit" className="create-button">
              Save
            </button>
            <button type="button" className="create-button cancel-button" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* 3-dot menu */}
          <FaEllipsisV
            className="menu-icon"
            onClick={() => setOpenMenu((prev) => !prev)}
            style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
            //onClick={toggleMenu}
          />
          {openMenu && (
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
                  onClick={() => {
                    handleToggleSavePost(post.post_id, isSaved);
                    setOpenMenu(false);
                  }}
                >
                  {isSaved ? 'Unsave' : 'Save'}
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
                  alert(`Report post ID: ${post.post_id}`);
                  setOpenMenu(false);
                }}
              >
                Report
              </button>
            </div>
          )}

          <div
            className="forum-description"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
          />
          <small>
            Posted by{' '}
            <RouterLink to={`/user/${post.user_id}`}>
              {post.first_name ? post.first_name : 'User'}{' '}
              {post.last_name ? post.last_name.charAt(0) + '.' : ''}
            </RouterLink>{' '}
            on {new Date(post.created_at).toLocaleString()}
          </small>

          {/* Upvote/Downvote + Reply Icon row */}
          <div className="vote-row">
            {/* Upvote Button */}
            <button
              type="button"
              className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
              onClick={() => handleUpvoteClick(post.post_id)}
              title="Upvote"
              aria-label="Upvote"
            >
              {upvoteIcon}
            </button>
            <span className="vote-count">{post.upvotes}</span>

            {/* Downvote Button */}
            <button
              type="button"
              className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
              onClick={() => handleDownvoteClick(post.post_id)}
              title="Downvote"
              aria-label="Downvote"
            >
              {downvoteIcon}
            </button>
            <span className="vote-count">{post.downvotes}</span>

            {/* Speech Bubble Reply Icon */}
            <button
              type="button"
              className="reply-button"
              onClick={handleToggleReplyBox}
              title="Reply"
              aria-label="Reply"
            >
              <FiMessageCircle />
            </button>

            {/* Collapse/Expand Replies Button */}
            {post.children && post.children.length > 0 && (
              <button
                type="button"
                className="collapse-button"
                onClick={toggleCollapse}
                title={isCollapsed ? 'Expand Replies' : 'Collapse Replies'}
                aria-label={isCollapsed ? 'Expand Replies' : 'Collapse Replies'}
              >
                {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                <span className="collapse-text">
                  {isCollapsed ? 'Show Replies' : 'Hide Replies'}
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Edit + Delete buttons */}
      <div className="post-actions">
        {canEdit && !isEditing && (
          <button className="create-button edit-button" onClick={startEditing}>
            Edit
          </button>
        )}
        {canDelete && (
          <button className="create-button delete-button" onClick={() => handleDeletePost(post.post_id)}>
            Delete
          </button>
        )}
      </div>

      {/* Reply Form */}
      {userData?.user_id && !isEditing && isReplyBoxOpen && (
        <form onSubmit={handleReplySubmitLocal} className="reply-form">
          <textarea
            placeholder="Write your reply..."
            value={localReply}
            onChange={handleLocalReplyChange}
            rows={3}
            required
            className="reply-textarea"
          />
          <div className="reply-form-actions">
            <button type="submit" className="create-button reply-button">
              Submit
            </button>
            <button type="button" className="create-button cancel-button" onClick={() => setExpandedReplyBox(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Recursively render child replies */}
      {post.children && post.children.length > 0 && !isCollapsed && (
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
              level={level + 1}
              savedPosts={savedPosts}
              handleToggleSavePost={handleToggleSavePost}
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

  const [savedPosts, setSavedPosts] = useState([]);

  // Toggle save for posts
  const handleToggleSavePost = async (postId, alreadySaved) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to save posts.' });
      return;
    }
    const url = alreadySaved ? '/api/unsave_post.php' : '/api/save_post.php';
    try {
      const resp = await axios.post(
        url,
        { user_id: userData.user_id, post_id: postId },
        { withCredentials: true }
      );
      if (resp.data.success) {
        await fetchSavedPosts();
        setNotification({ type: 'success', message: alreadySaved ? 'Post unsaved!' : 'Post saved!' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Error saving post.' });
      }
    } catch (error) {
      console.error('Error saving/unsaving post:', error);
      setNotification({ type: 'error', message: 'Error saving/unsaving post.' });
    }
  };

  // Fetch saved posts
  const fetchSavedPosts = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(`/api/fetch_saved_posts.php?user_id=${userData.user_id}`, {
        withCredentials: true,
      });
      if (resp.data.success) {
        setSavedPosts(resp.data.saved_posts || []);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    }
  };

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

      // Ensure upvotes and downvotes are numbers
      const numericData = data.map((post) => ({
        ...post,
        upvotes: Number(post.upvotes) || 0,
        downvotes: Number(post.downvotes) || 0,
      }));

      const tree = buildReplyTree(numericData);
      setPostTree(tree);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setPostTree([]);
      setNotification({ type: 'error', message: 'Failed to load posts.' });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // load posts + saved posts
  useEffect(() => {
    fetchPosts();
    if (userData) {
      fetchSavedPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread_id, userData]);

  // handleReplySubmit for new replies
  const handleReplySubmit = async (reply_to_post_id, content) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to reply.' });
      return;
    }
  
    try {
      const response = await axios.post('/api/create_reply.php', {
        thread_id: Number(thread_id),
        user_id: userData.user_id,
        content,
        reply_to: reply_to_post_id,
      });
  
      if (response.data.success) {
        fetchPosts();
        setExpandedReplyBox(null);
        setNotification({ type: 'success', message: 'Reply created successfully.' });
  
        // Notify the original poster
        await axios.post('/api/add_reply_notification.php', {
          post_id: reply_to_post_id,
          replier_id: userData.user_id,
        });
  
      } else {
        setNotification({ type: 'error', message: response.data.error || 'Error submitting reply.' });
      }
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
      // Update the post vote counts without refreshing
      setPostTree((prevPostTree) => {
        const updateVotes = (posts) =>
          posts.map((p) => {
            if (p.post_id === post_id) {
              let newUpvotes = p.upvotes;
              let newDownvotes = p.downvotes;
              let newUserVote = p.user_vote;

              if (p.user_vote === 'up') {
                // Remove upvote
                newUpvotes -= 1;
                newUserVote = null;
              } else if (p.user_vote === 'down') {
                // Change downvote to upvote
                newDownvotes -= 1;
                newUpvotes += 1;
                newUserVote = 'up';
              } else {
                // Add upvote
                newUpvotes += 1;
                newUserVote = 'up';
              }
              return {
                ...p,
                upvotes: newUpvotes,
                downvotes: newDownvotes,
                user_vote: newUserVote,
              };
            } else if (p.children && p.children.length > 0) {
              return { ...p, children: updateVotes(p.children) };
            }
            return p;
          });
        return updateVotes(prevPostTree);
      });
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
      // Update the post vote counts without refreshing
      setPostTree((prevPostTree) => {
        const updateVotes = (posts) =>
          posts.map((p) => {
            if (p.post_id === post_id) {
              let newUpvotes = p.upvotes;
              let newDownvotes = p.downvotes;
              let newUserVote = p.user_vote;

              if (p.user_vote === 'down') {
                // Remove downvote
                newDownvotes -= 1;
                newUserVote = null;
              } else if (p.user_vote === 'up') {
                // Change upvote to downvote
                newUpvotes -= 1;
                newDownvotes += 1;
                newUserVote = 'down';
              } else {
                // Add downvote
                newDownvotes += 1;
                newUserVote = 'down';
              }
              return {
                ...p,
                upvotes: newUpvotes,
                downvotes: newDownvotes,
                user_vote: newUserVote,
              };
            } else if (p.children && p.children.length > 0) {
              return { ...p, children: updateVotes(p.children) };
            }
            return p;
          });
        return updateVotes(prevPostTree);
      });
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

      <h2 className="forum-title">{threadData?.title || `Thread ${thread_id}`}</h2>

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
              level={1}
              // pass savedPosts + toggle fn
              savedPosts={savedPosts}
              handleToggleSavePost={handleToggleSavePost}
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
            aria-label="Close Notification"
          >
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default ThreadView;
