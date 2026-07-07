// src/components/ThreadView.js
import './ThreadView.css';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useLocation } from 'react-router-dom';
import useOnClickOutside from '../hooks/useOnClickOutside'; // <--- import the hook
import axios from 'axios';
import debounce from 'lodash.debounce';
import { ROLE_MODERATOR } from '../constants/roles';
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
  FaCheckCircle,
} from 'react-icons/fa';
import { FiMessageCircle } from 'react-icons/fi';

// Tiptap imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// Additional Tiptap Extensions
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';

// For sanitizing HTML
import DOMPurify from 'dompurify';
import ReportModal from './ReportModal';
import { buildAvatarSrc } from '../utils/avatar';
import { buildUploadSrc } from '../utils/uploads';
import { getTagStyle } from '../utils/tagStyle';

// Helper: relative time formatter
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 3600) { // up to 60 minutes show minutes
    const mins = Math.max(1, Math.floor(seconds / 60));
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) { // hours
    const hours = Math.max(1, Math.round(seconds / 3600));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const intervals = [
    { label: 'year', secs: 31536000 },
    { label: 'month', secs: 2592000 },
    { label: 'week', secs: 604800 },
    { label: 'day', secs: 86400 },
  ];
  for (const it of intervals) {
    const count = Math.floor(seconds / it.secs);
    if (count >= 1) return `${count} ${it.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

const formatVerifiedDate = (dateStr) => {
  if (!dateStr) return '';
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const year = parsed.getUTCFullYear();
  return `${month}-${day}-${year}`;
};

const hasMeaningfulUpdate = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 1000;
};

const getVerificationDisclaimer = (communityType) => {
  const type = String(communityType || '').toLowerCase();
  const target = type === 'university' ? 'university' : 'community';
  const ambassadorLabel = type === 'university' ? 'school ambassador' : 'community ambassador';
  return `This post has been verified correct by a ${ambassadorLabel}. Information may have changed since the time of posting, so it is always best to check with the ${target} directly.`;
};

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const getDisplayName = (author, viewerId) => {
  const first = author?.first_name || 'User';
  const last = author?.last_name || '';
  const isSelf = viewerId && String(viewerId) === String(author?.user_id);
  const isConnection = Number(author?.is_connection) === 1;
  const showFullLast = isSelf || isConnection;
  const lastPortion = last ? (showFullLast ? last : `${last.charAt(0)}.`) : '';
  return `${first}${lastPortion ? ` ${lastPortion}` : ''}`;
};

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
// Build the reply tree
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
  function markVerified(node) {
    let verified = Number(node.verified) === 1;
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        verified = verified || markVerified(child);
      });
    }
    node.hasVerified = verified;
    return verified;
  }
  roots.forEach(markVerified);
  return roots;
}

// Sort replies by splitting verified vs non-verified then applying the chosen criteria.
function sortReplyNodes(nodes, criteria) {
  const verifiedNodes = nodes.filter((n) => Number(n.hasVerified));
  const nonVerifiedNodes = nodes.filter((n) => !n.hasVerified);

  let sortFn;
  switch (criteria) {
    case 'mostRecent':
      sortFn = (a, b) => new Date(b.created_at) - new Date(a.created_at);
      break;
    case 'mostUpvoted':
      sortFn = (a, b) => b.upvotes - a.upvotes;
      break;
    case 'mostPopular':
      sortFn = (a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes);
      break;
    default:
      sortFn = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  }
  verifiedNodes.sort(sortFn);
  nonVerifiedNodes.sort(sortFn);
  const sortedNodes = [...verifiedNodes, ...nonVerifiedNodes];
  sortedNodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      node.children = sortReplyNodes(node.children, criteria);
    }
  });
  return sortedNodes;
}

// Recursive sort function to sort children arrays
function sortTree(nodes) {
  nodes.sort((a, b) => {
    if (a.hasVerified === b.hasVerified) {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return a.hasVerified ? -1 : 1;
  });
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      sortTree(node.children);
    }
  });
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
  handleVerifyPost, // NEW prop for verifying posts
  handleUnverifyPost,
  canVerifyPosts,
  communityType,
  onRequireAuth,
  onReport,
}) {
  const [localReply, setLocalReply] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // 3-dot menu
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  const shouldAutoExpand = !isRoot && (Number(post.verified) !== 1 && Number(post.hasVerified) === 1);
  const [isCollapsed, setIsCollapsed] = useState(isRoot ? false : !shouldAutoExpand);

  const toggleMenu = () => setOpenMenu((prev) => !prev);

  useOnClickOutside(menuRef, () => {
    if (openMenu) {
      setOpenMenu(false);
    }
  });

  const postContext = stripHtml(post.content || '').slice(0, 200);
  const reportLabel = post.reply_to ? 'comment' : 'post';

  // Check if post is saved
  const baseSaved =
    Boolean(post.saved) ||
    savedPosts.some((pSaved) => Number(pSaved.post_id) === Number(post.post_id));
  const [savedStatus, setSavedStatus] = useState(baseSaved);
  const isSaved = savedStatus ?? baseSaved;

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

    canDelete = roleNum === ROLE_MODERATOR || userIdNum === postOwnerId;
    // Only allow editing the root post if user is either admin or post owner
    canEdit = isRoot && canDelete;
  }

  console.log("UserData:", userData);
  console.log("Post Verification Status:", post.verified);

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

  const getDescendantCount = (nodes = []) =>
    nodes.reduce(
      (sum, node) => sum + 1 + (node.children && node.children.length > 0 ? getDescendantCount(node.children) : 0),
      0
    );
  const childReplyCount = getDescendantCount(post.children || []);

  // Determine if the reply box for this post is open
  const isReplyBoxOpen = expandedReplyBox === post.post_id;

  const handleToggleReplyBox = () => {
    if (!userData) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }
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

  const computedClassName = `forum-card reply-card level-${level} ${
    Number(post.verified) === 1 ? 'verified' : ''
  }`;
  const postAnchorId = String(post.post_id || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^#/, '');
  const canVerify = canVerifyPosts;
  const canUnverifyOwn =
    Number(post.verified) === 1 &&
    String(post.verified_by || '') === String(userData?.user_id || '');

  useEffect(() => {
    setSavedStatus(baseSaved);
  }, [baseSaved]);

  useEffect(() => {
    if (!openMenu || !userData?.user_id) return;
    const loadSavedStatus = async () => {
      try {
        const resp = await axios.get('/api/save_check.php', {
          params: { user_id: userData.user_id, item_type: 'post', item_id: post.post_id },
          withCredentials: true,
        });
        const saved = Boolean(resp.data?.saved ?? resp.data?.is_saved);
        setSavedStatus(saved);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('save_check failed for post', err);
      }
    };
    loadSavedStatus();
  }, [openMenu, userData?.user_id, post.post_id]);
  
  return (
    <div id={`post-${postAnchorId}`} className={`post-card card-lift level-${level}`}>
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
            <button
              type="button"
              className="create-button cancel-button"
              onClick={cancelEditing}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={`verified-scope ${Number(post.verified) === 1 ? 'verified' : ''}`}>
            {Number(post.verified) === 1 && (
              <div className="verified-banner">
                <div className="verified-badge">
                  <FaCheckCircle className="verified-icon" />
                  <div>
                    <div className="verified-title">Verified Correct</div>
                    {post.verified_at && (
                      <div className="verified-date">
                        Verified on {formatVerifiedDate(post.verified_at)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="verified-disclaimer">
                  {getVerificationDisclaimer(communityType)}
                </div>
              </div>
            )}
            {/* Reply header: avatar + meta */}
            <div className="post-header-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '2px', marginBottom: '6px' }}>
              {/* 3-dot menu */}
              <FaEllipsisV
                className="menu-icon post-header-menu"
                onClick={() => setOpenMenu((prev) => !prev)}
              />
              {openMenu && (
                <div
                  ref={menuRef}
                  className="dropdown-menu post-header-menu-panel"
                >
                  {handleToggleSavePost && (
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        handleToggleSavePost(post.post_id, isSaved);
                        setSavedStatus((prev) => !prev);
                        setOpenMenu(false);
                      }}
                    >
                      {isSaved ? 'Unsave' : 'Save'}
                    </button>
                  )}
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      if (onReport) {
                        onReport({
                          id: post.post_id,
                          type: reportLabel,
                          label: reportLabel,
                          context: postContext,
                        });
                      }
                      setOpenMenu(false);
                    }}
                  >
                    Report {reportLabel === 'comment' ? 'comment' : 'post'}
                  </button>
                  {canVerify && post.verified !== 1 && (
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        handleVerifyPost(post.post_id);
                        setOpenMenu(false);
                      }}
                    >
                      Verify answer
                    </button>
                  )}
                  {canUnverifyOwn && (
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        handleUnverifyPost(post.post_id);
                        setOpenMenu(false);
                      }}
                    >
                      Unverify answer
                    </button>
                  )}
                </div>
              )}
              <div className="avatar-wrapper">
                <img
                  src={buildAvatarSrc(post.avatar_path)}
                  alt={getDisplayName(post, userData?.user_id)}
                  className="avatar-image"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = buildAvatarSrc(null);
                  }}
                />
              </div>
              <div className="post-meta" style={{ margin: 0 }}>
                <div className="post-author-line">
                  <RouterLink to={`/user/${post.user_id}`} className="post-author-name" style={{ textDecoration: 'none', fontWeight: 600 }}>
                    {getDisplayName(post, userData?.user_id)}
                  </RouterLink>
                  <span className="author-badges">
                    {Number(post.author_verified) === 1 && (
                      <FaCheckCircle className="author-verified-icon" title="Verified" />
                    )}
                    {post.ambassador_logo_path && (
                      <img
                        src={buildUploadSrc(post.ambassador_logo_path)}
                        alt="Ambassador badge"
                        className="author-ambassador-logo"
                        title="Ambassador"
                      />
                    )}
                  </span>
                </div>
                <div className="meta-quiet" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {post.school_name && <span>{post.school_name}</span>}
                  <span>{timeAgo(post.created_at)}</span>
                  {hasMeaningfulUpdate(post.created_at, post.updated_at) && post.updated_by_first_name && (
                    <>
                      <span>· Edited {timeAgo(post.updated_at)} by</span>
                      <img
                        src={buildAvatarSrc(post.updated_by_avatar_path)}
                        alt={`${post.updated_by_first_name} ${post.updated_by_last_name || ''}`}
                        style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = buildAvatarSrc(null);
                        }}
                      />
                      <span>{post.updated_by_first_name} {post.updated_by_last_name || ''}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div
              className="forum-description"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />
    
            {/* Upvote count + Reply */}
            <div className="vote-row">
              <button
                type="button"
                className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
                onClick={() => handleUpvoteClick(post.post_id)}
                title="Upvote"
                aria-label="Upvote"
              >
                {hasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
              </button>
              <span className="vote-count">{post.upvotes}</span>
              <button
                type="button"
                className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
                onClick={() => handleDownvoteClick(post.post_id)}
                title="Downvote"
                aria-label="Downvote"
              >
                {hasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
              </button>
              <span className="vote-count">{post.downvotes}</span>

              {/* Reply Button */}
              <button
                type="button"
                className="reply-button"
                onClick={handleToggleReplyBox}
                title="Reply"
                aria-label="Reply"
              >
                <FiMessageCircle />
              </button>
              <span className="vote-count comment-count">{childReplyCount}</span>
    
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
          <button
            className="create-button delete-button" onClick={() => handleDeletePost(post.post_id)}
          >
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
              handleVerifyPost={handleVerifyPost} // pass the verify function down
              handleUnverifyPost={handleUnverifyPost}
              canVerifyPosts={canVerifyPosts}
              communityType={communityType}
              onRequireAuth={onRequireAuth}
              onReport={onReport}
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
function ThreadView({ userData, onRequireAuth }) {
  const { thread_id } = useParams();
  const location = useLocation();

  const [threadData, setThreadData] = useState(null);
  const [postTree, setPostTree] = useState([]);
  const [originalPost, setOriginalPost] = useState(null);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  const [notification, setNotification] = useState(null);
  const [expandedReplyBox, setExpandedReplyBox] = useState(null);
  const [rootReplyOpen, setRootReplyOpen] = useState(false);
  const [rootReplyContent, setRootReplyContent] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  const [replySortCriteria, setReplySortCriteria] = useState('mostRecent');
  const [savedPosts, setSavedPosts] = useState([]);
  const [sessionAmbassadorCommunities, setSessionAmbassadorCommunities] = useState([]);
  const [hasSessionAmbassadorSnapshot, setHasSessionAmbassadorSnapshot] = useState(false);
  const countReplies = (nodes = []) =>
    nodes.reduce(
      (sum, node) => sum + 1 + (node.children && node.children.length > 0 ? countReplies(node.children) : 0),
      0
    );
  const totalComments = useMemo(() => countReplies(postTree), [postTree]);

  const targetPostId = useMemo(() => {
    const searchValue = new URLSearchParams(location.search).get('post_id') || '';
    const hashValue = location.hash?.startsWith('#post-') ? location.hash.slice('#post-'.length) : '';
    const raw = searchValue || hashValue;
    return String(raw || '')
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .replace(/^#/, '');
  }, [location.search, location.hash]);

  const ambassadorCommunityIds = useMemo(() => {
    const fromSession = Array.isArray(sessionAmbassadorCommunities) ? sessionAmbassadorCommunities : [];
    const fromUserData = Array.isArray(userData?.ambassador_communities) ? userData.ambassador_communities : [];
    const source = hasSessionAmbassadorSnapshot ? fromSession : fromUserData;
    return source
      .map((item) => String(item?.community_id ?? item?.id ?? item ?? ''))
      .filter(Boolean);
  }, [hasSessionAmbassadorSnapshot, sessionAmbassadorCommunities, userData?.ambassador_communities]);

  const canVerifyPosts = useMemo(() => {
    if (!userData?.user_id) return false;
    const communityId = String(threadData?.community_id ?? '');
    if (!communityId) return false;
    return ambassadorCommunityIds.includes(communityId);
  }, [userData?.user_id, threadData?.community_id, ambassadorCommunityIds]);


  const promptAuthOverlay = () => {
    if (onRequireAuth) {
      onRequireAuth();
    }
  };

  // Toggle save for posts
  const handleToggleSavePost = async (postId, alreadySaved) => {
    if (!userData) {
      promptAuthOverlay();
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

  // NEW: Function to verify a post
  const handleVerifyPost = async (post_id) => {
    const isAllowed = canVerifyPosts;
    if (!isAllowed) {
      setNotification({ type: 'error', message: 'You are not authorized to verify posts.' });
      return;
    }
    try {
      const response = await axios.post('/api/verify_post.php', {
        post_id,
      }, { withCredentials: true });
      if (response.data.success) {
        setNotification({ type: 'success', message: 'Post verified successfully!' });
        fetchPosts();
      } else {
        setNotification({ type: 'error', message: response.data.error || 'Error verifying post.' });
      }
    } catch (error) {
      console.error('Error verifying post:', error);
      setNotification({ type: 'error', message: 'An error occurred while verifying the post.' });
    }
  };

  const handleUnverifyPost = async (post_id) => {
    try {
      const response = await axios.post('/api/unverify_post.php', {
        post_id,
      }, { withCredentials: true });
      if (response.data.success) {
        setNotification({ type: 'success', message: 'Post unverified successfully!' });
        fetchPosts();
      } else {
        setNotification({ type: 'error', message: response.data.error || 'Error unverifying post.' });
      }
    } catch (error) {
      console.error('Error unverifying post:', error);
      setNotification({ type: 'error', message: 'An error occurred while unverifying the post.' });
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
        setNotification({ type: 'success', message: 'Report submitted to moderators.' });
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

  useEffect(() => {
    const fetchThread = async () => {
      if (!thread_id) {
        setIsLoadingThread(false);
        setNotification({ type: 'error', message: 'Thread not found.' });
        return;
      }
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

  useEffect(() => {
    let isCancelled = false;
    const refreshSessionAmbassadorCommunities = async () => {
      if (!userData?.user_id) {
        if (!isCancelled) {
          setSessionAmbassadorCommunities([]);
          setHasSessionAmbassadorSnapshot(false);
        }
        return;
      }
      try {
        const res = await axios.get('/api/check_session.php', { withCredentials: true });
        const fromSession = Array.isArray(res.data?.user?.ambassador_communities)
          ? res.data.user.ambassador_communities
          : [];
        if (!isCancelled) {
          setSessionAmbassadorCommunities(fromSession);
          setHasSessionAmbassadorSnapshot(true);
        }
      } catch (err) {
        console.error('Error refreshing ambassador communities from session:', err);
        if (!isCancelled) {
          setSessionAmbassadorCommunities([]);
          setHasSessionAmbassadorSnapshot(false);
        }
      }
    };
    refreshSessionAmbassadorCommunities();
    return () => {
      isCancelled = true;
    };
  }, [thread_id, userData?.user_id]);

  // Build the nested structure of posts
  const fetchPosts = async () => {
    if (!thread_id) {
      setPostTree([]);
      setIsLoadingPosts(false);
      return;
    }
    setIsLoadingPosts(true);
    try {
      let url = `/api/fetch_posts.php?thread_id=${thread_id}`;
      if (userData?.user_id) {
        url += `&user_id=${userData.user_id}`;
      }
      const res = await axios.get(url);
      const data = Array.isArray(res.data) ? res.data : [];
      console.log("Fetched Posts:", data);
      const normalizedData = data.map((post) => ({
        ...post,
        upvotes: Number(post.upvotes) || 0,
        downvotes: Number(post.downvotes) || 0,
        verified: Number(post.verified) || 0,
      }));
      // Identify original post (first root by created_at)
      const rootCandidates = normalizedData.filter((p) => !p.reply_to);
      rootCandidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const op = rootCandidates[0] || null;
      setOriginalPost(op || null);
      const repliesSource = op ? normalizedData.filter((p) => p.post_id !== op.post_id) : normalizedData;
      let tree = buildReplyTree(repliesSource);
      tree = sortReplyNodes(tree, replySortCriteria);
      setPostTree(tree);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setPostTree([]);
      setNotification({ type: 'error', message: 'Failed to load posts.' });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    if (userData) {
      fetchSavedPosts();
    }
  }, [thread_id, userData]);

  useEffect(() => {
    if (isLoadingPosts || !targetPostId) return;
    const node = document.getElementById(`post-${targetPostId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('post-target-highlight');
    const timeoutId = window.setTimeout(() => {
      node.classList.remove('post-target-highlight');
    }, 2400);
    return () => window.clearTimeout(timeoutId);
  }, [isLoadingPosts, targetPostId, postTree.length, originalPost?.post_id]);

  useEffect(() => {
    setRootReplyOpen(false);
    setRootReplyContent('');
  }, [originalPost?.post_id]);

  // Re-sort the reply tree when sort criteria changes.
  useEffect(() => {
    setPostTree((prevTree) => sortReplyNodes([...prevTree], replySortCriteria));
  }, [replySortCriteria]);


  const handleReplySubmit = async (reply_to_post_id, content) => {
    if (!userData) {
      promptAuthOverlay();
      return;
    }
  
    try {
      const response = await axios.post('/api/create_reply.php', {
        thread_id,
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
      setNotification({
        type: 'error',
        message: error?.response?.data?.error || 'An error occurred while creating the reply.',
      });
    }
  };  

  const handleOpenRootReply = () => {
    if (!originalPost) return;
    if (!userData) {
      promptAuthOverlay();
      return;
    }
    setRootReplyOpen(true);
  };

  const handleRootReplySubmit = async (e) => {
    e.preventDefault();
    if (!originalPost) return;
    await handleReplySubmit(originalPost.post_id, rootReplyContent);
    setRootReplyContent('');
    setRootReplyOpen(false);
  };

  const handleCancelRootReply = () => {
    setRootReplyContent('');
    setRootReplyOpen(false);
  };

  const originalHasUpvoted = originalPost?.user_vote === 'up';
  const originalHasDownvoted = originalPost?.user_vote === 'down';
  const originalUpvotes = Number(originalPost?.upvotes) || 0;
  const originalDownvotes = Number(originalPost?.downvotes) || 0;

  // handleDeletePost
  const handleDeletePost = async (post_id) => {
    if (!userData) {
      promptAuthOverlay();
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
      promptAuthOverlay();
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
      promptAuthOverlay();
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'up',
      });
      const isRoot = originalPost && originalPost.post_id === post_id;
      if (isRoot) {
        setOriginalPost((prev) => {
          if (!prev) return prev;
          let newUpvotes = prev.upvotes;
          let newDownvotes = prev.downvotes;
          let newUserVote = prev.user_vote;
          if (prev.user_vote === 'up') {
            newUpvotes -= 1;
            newUserVote = null;
          } else if (prev.user_vote === 'down') {
            newDownvotes -= 1;
            newUpvotes += 1;
            newUserVote = 'up';
          } else {
            newUpvotes += 1;
            newUserVote = 'up';
          }
          return { ...prev, upvotes: newUpvotes, downvotes: newDownvotes, user_vote: newUserVote };
        });
        return;
      }
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
      promptAuthOverlay();
      return;
    }
    try {
      await axios.post('/api/vote_post.php', {
        post_id,
        user_id: userData.user_id,
        vote_type: 'down',
      });
      const isRoot = originalPost && originalPost.post_id === post_id;
      if (isRoot) {
        setOriginalPost((prev) => {
          if (!prev) return prev;
          let newUpvotes = prev.upvotes;
          let newDownvotes = prev.downvotes;
          let newUserVote = prev.user_vote;
          if (prev.user_vote === 'down') {
            newDownvotes -= 1;
            newUserVote = null;
          } else if (prev.user_vote === 'up') {
            newUpvotes -= 1;
            newDownvotes += 1;
            newUserVote = 'down';
          } else {
            newDownvotes += 1;
            newUserVote = 'down';
          }
          return { ...prev, upvotes: newUpvotes, downvotes: newDownvotes, user_vote: newUserVote };
        });
        return;
      }
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
    return (
      <div className="feed-container thread-view thread-view--loading">
        <p>Loading Threads and Posts...</p>
      </div>
    );
  }

  // Final return block
  return (
    <div className="feed-container thread-view">
      {/* Breadcrumbs */}
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <RouterLink to="/info">Info Board</RouterLink>
        <span className="breadcrumb-sep">/</span>
        {threadData?.forum_id ? (
          <RouterLink to={`/info/forum/${threadData.forum_id}`}>
            {threadData?.forum_name || 'Category'}
          </RouterLink>
        ) : (
          <span>{threadData?.forum_name || 'Category'}</span>
        )}
        <span className="breadcrumb-sep">/</span>
        {/*<span className="breadcrumb-current" aria-current="page">
          {threadData?.title || `Thread ${thread_id}`}
        </span>*/}
      </nav>
      {/* Title */}
      <h1 className="h1" style={{ margin: 0 }}>
        {threadData?.title || `Thread ${thread_id}`}
      </h1>

      {/* Tags under title */}
      {Array.isArray(threadData?.tags) && threadData.tags.length > 0 && (
        <div className="chips-row" style={{ display: 'flex', gap: '8px', marginTop: '8px', marginBottom: '8px' }}>
          {threadData.tags.map((tag, idx) => (
            <span
              key={idx}
              className="chip tag-chip"
              style={{ ...getTagStyle(tag), border: '1px solid', borderRadius: '9999px', padding: '4px 10px', fontWeight: 600 }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {hasMeaningfulUpdate(threadData?.created_at, threadData?.updated_at) && (
        <div className="meta-quiet" style={{ marginTop: 2, marginBottom: 10 }}>
          Last updated {timeAgo(threadData.updated_at)}
          {threadData.updated_by_first_name ? ` by ${threadData.updated_by_first_name} ${threadData.updated_by_last_name || ''}` : ''}
        </div>
      )}

      {/* Original Post at top */}
      {originalPost && (
        <div
          id={`post-${String(originalPost.post_id || '')
            .trim()
            .replace(/^["']+|["']+$/g, '')
            .replace(/^#/, '')}`}
          className="post-card card-lift original-post"
        >
          <div className={`verified-scope ${Number(originalPost.verified) === 1 ? 'verified' : ''}`}>
            {Number(originalPost.verified) === 1 && (
              <div className="verified-banner">
                <div className="verified-badge">
                  <FaCheckCircle className="verified-icon" />
                  <div>
                    <div className="verified-title">Verified Correct</div>
                    {originalPost.verified_at && (
                      <div className="verified-date">
                        Verified on {formatVerifiedDate(originalPost.verified_at)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="verified-disclaimer">
                  {getVerificationDisclaimer(threadData?.community_type)}
                </div>
              </div>
            )}

            {/* Use the thread-top-row pattern inside the card */}
            <div className="thread-top-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar-wrapper">
                  <img
                    src={buildAvatarSrc(originalPost.avatar_path)}
                    alt={getDisplayName(originalPost, userData?.user_id)}
                    className="avatar-image"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = buildAvatarSrc(null);
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <RouterLink to={`/user/${originalPost.user_id}`} className="post-author-name" style={{ textDecoration: 'none', fontWeight: 700 }}>
                      {getDisplayName(originalPost, userData?.user_id)}
                    </RouterLink>
                    {originalPost.user_role && <span className="meta-quiet">· {originalPost.user_role}</span>}
                  </div>
                  <div className="meta-quiet">{timeAgo(originalPost.created_at)}</div>
                  {hasMeaningfulUpdate(originalPost.created_at, originalPost.updated_at) && (
                    <div className="meta-quiet">Edited {timeAgo(originalPost.updated_at)}</div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="post-content"
              style={{ marginTop: '8px' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(originalPost.content) }}
            />
            <div className="vote-row">
              <button
                type="button"
                className={`vote-button upvote-button ${originalHasUpvoted ? 'active' : ''}`}
                onClick={() => handleUpvoteClick(originalPost.post_id)}
                title="Upvote"
                aria-label="Upvote"
              >
                {originalHasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
              </button>
              <span className="vote-count">{originalUpvotes}</span>
              <button
                type="button"
                className={`vote-button downvote-button ${originalHasDownvoted ? 'active' : ''}`}
                onClick={() => handleDownvoteClick(originalPost.post_id)}
                title="Downvote"
                aria-label="Downvote"
              >
                {originalHasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
              </button>
              <span className="vote-count">{originalDownvotes}</span>
              <button
                type="button"
                className="reply-button"
                onClick={handleOpenRootReply}
                title="Leave a comment"
                aria-label="Leave a comment"
              >
                <FiMessageCircle />
              </button>
              <span className="vote-count comment-count">{totalComments}</span>
              <button
                type="button"
                className="report-inline-button"
                onClick={() =>
                  handleOpenReport({
                    id: originalPost.post_id,
                    type: 'post',
                    label: 'original post',
                    context: stripHtml(originalPost.content || '').slice(0, 200),
                  })
                }
              >
                Report
              </button>
            </div>
          </div>
      {rootReplyOpen && (
        <form className="reply-form" onSubmit={handleRootReplySubmit}>
          <textarea
            className="reply-textarea"
            rows={4}
            value={rootReplyContent}
            onChange={(e) => setRootReplyContent(e.target.value)}
            placeholder="Share your thoughts..."
            required
          />
          <div className="reply-form-actions">
            <button type="submit" className="create-button reply-button">
              Submit
            </button>
            <button type="button" className="create-button cancel-button" onClick={handleCancelRootReply}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <hr className="thread-divider" />
    </div>
  )}

  <div className="reply-sort-controls filter-toolbar filter-toolbar--sort-only">
        <label htmlFor="replySort" className="sort-pill">Sort replies</label>
        <select
          id="replySort"
          value={replySortCriteria}
          onChange={(e) => setReplySortCriteria(e.target.value)}
          className="sort-select"
        >
          <option value="mostRecent">Sort by Newest</option>
          <option value="mostUpvoted">Most Upvoted</option>
          <option value="mostPopular">Most Popular</option>
        </select>
      </div>

      {/* Post Tree */}
      {postTree.length === 0 ? (
        <p>No replies found.</p>
      ) : (
        <div className="post-list">
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
              savedPosts={savedPosts}
              handleToggleSavePost={handleToggleSavePost}
              handleVerifyPost={handleVerifyPost}
              handleUnverifyPost={handleUnverifyPost}
              canVerifyPosts={canVerifyPosts}
              communityType={threadData?.community_type}
              onRequireAuth={onRequireAuth}
              onReport={handleOpenReport}
            />
          ))}
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
          <button className="notification-close" onClick={() => setNotification(null)}>
            X
          </button>
        </div>
      )}
    </div>
  ); 
}

export default ThreadView;
