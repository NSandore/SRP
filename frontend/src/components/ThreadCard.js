// src/components/ThreadCard.js
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown,
  FaQuestionCircle,
  FaBookOpen,
  FaLightbulb,
} from 'react-icons/fa';
import IconBubble from './IconBubble';
import { isSuperAdmin } from '../constants/roles';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 3600) {
    const mins = Math.max(1, Math.floor(seconds / 60));
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
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

function useOnClickOutside(ref, handler) {
  React.useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// Infer a type when explicit type isn't provided
const inferTypeFromTitle = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('guide')) return 'guide';
  if (t.includes('study')) return 'study';
  if (t.endsWith('?') || t.includes('how ') || t.includes('what ') || t.includes('why ')) return 'question';
  return 'question';
};

const iconForThreadType = (type) => {
  switch ((type || '').toLowerCase()) {
    case 'guide':
      return { token: 'guide', Icon: FaBookOpen };
    case 'study':
    case 'study tips':
      return { token: 'study', Icon: FaLightbulb };
    case 'question':
    default:
      return { token: 'question', Icon: FaQuestionCircle };
  }
};

export default function ThreadCard({
  thread,
  userData,
  onUpvote,
  onDownvote,
  onEdit,
  onDelete,
  onToggleSave,
  onReport,
  linkTo,
}) {
  const hasUpvoted = thread.user_vote === 'up' || thread.vote_type === 'up';
  const hasDownvoted = thread.user_vote === 'down' || thread.vote_type === 'down';
  const canEditOrDelete =
    userData && (isSuperAdmin(userData.role_id) || Number(userData.user_id) === Number(thread.user_id));

  const [menuOpen, setMenuOpen] = useState(false);
  const [isPinSubmenuOpen, setIsPinSubmenuOpen] = useState(false);
  const menuRef = useRef(null);
  useOnClickOutside(menuRef, () => {
    setMenuOpen(false);
    setIsPinSubmenuOpen(false);
  });
  const ambassadorCommunities = Array.isArray(userData?.ambassador_communities)
    ? userData.ambassador_communities
        .map((community) => ({
          community_id: String(community?.community_id ?? community?.id ?? ''),
          name: String(community?.name ?? 'Community'),
        }))
        .filter((community) => community.community_id)
    : [];
  const canPinToCommunity = ambassadorCommunities.length > 0;

  // Determine thread type: prefer explicit field if present, else infer from title
  const threadType = useMemo(() => {
    return thread.thread_type || thread.type || inferTypeFromTitle(thread.title);
  }, [thread.thread_type, thread.type, thread.title]);
  const { token: typeToken, Icon: TypeIcon } = useMemo(() => iconForThreadType(threadType), [threadType]);
  const threadUrl =
    linkTo || `/info/forum/${thread.forum_id}/thread/${thread.thread_id}`;

  const initials = `${(thread.first_name || 'U')[0] || 'U'}${(thread.last_name || '')[0] || ''}`.toUpperCase();
  const comments = thread.post_count || thread.comment_count || 0;

  const handlePinThread = async (communityId) => {
    try {
      const response = await axios.post(
        '/api/pin_to_community.php',
        {
          community_id: communityId,
          item_id: thread.thread_id,
          item_type: 'thread'
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        alert(response.data.already_pinned ? 'Thread is already pinned to that community.' : 'Thread pinned to community.');
        setMenuOpen(false);
        setIsPinSubmenuOpen(false);
      } else {
        alert(`Error: ${response.data.error || 'Unable to pin thread.'}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error pinning thread:', error);
      alert('Error pinning thread.');
    }
  };

  return (
    <div className="thread-card card-lift" style={{ position: 'relative' }}>
      {/* Kebab */}
      <button
        type="button"
        className="kebab-button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer' }}
      >
        <FaEllipsisV />
      </button>
      {menuOpen && (
        <div ref={menuRef} className="dropdown-menu" style={{ position: 'absolute', top: 30, right: 8, zIndex: 10 }}>
          {canPinToCommunity && (
            <div className="dropdown-item submenu-container">
              <button
                type="button"
                className="submenu-title"
                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '8px' }}
                onClick={() => setIsPinSubmenuOpen((open) => !open)}
              >
                Pin to Community
              </button>
              {isPinSubmenuOpen && (
                <ul className="submenu-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {ambassadorCommunities.map((community) => (
                    <li
                      key={community.community_id}
                      className="submenu-item"
                      style={{ padding: '6px 8px', cursor: 'pointer', borderTop: '1px solid var(--card-border)' }}
                      onClick={() => handlePinThread(community.community_id)}
                    >
                      {community.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {onToggleSave && (
            <button className="dropdown-item" onClick={() => onToggleSave(thread)}>
              {thread.saved ? 'Unsave' : 'Save'}
            </button>
          )}
          <button
            className="dropdown-item"
            onClick={() => {
              if (onReport) {
                onReport(thread);
              }
              setMenuOpen(false);
            }}
          >
            Report
          </button>
          {canEditOrDelete && (
            <>
              <button className="dropdown-item" onClick={() => { setMenuOpen(false); onEdit && onEdit(thread); }}>
                Edit
              </button>
              <button className="dropdown-item" onClick={() => { setMenuOpen(false); onDelete && onDelete(thread.thread_id); }}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Left icon + Title */}
      <div className="card-top-row">
        <IconBubble icon={TypeIcon} bg={typeToken} />
        <Link to={threadUrl} className="thread-link">
          <h3 className="thread-title">{thread.title}</h3>
        </Link>
      </div>

      {Array.isArray(thread.tags) && thread.tags.length > 0 && (
        <div className="chips-row" style={{ marginTop: '4px' }}>
          {thread.tags.map((tag) => (
            <span key={tag} className="chip tag-chip">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta Row */}
      <div className="meta-row">
        <div className="avatar-circle" aria-hidden="true">{initials}</div>
        <Link to={`/user/${thread.user_id}`} className="meta-author">{thread.first_name} {thread.last_name ? thread.last_name[0] + '.' : ''}</Link>
        <span className="middot">•</span>
        {thread.community_name && (
          <Link to={`/${thread.community_type}/${thread.community_id}`} className="meta-community">{thread.community_name}</Link>
        )}
        <span className="middot">•</span>
        <span className="meta-time">{timeAgo(thread.created_at)}</span>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <button
          type="button"
          className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
          title="Upvote"
          onClick={() => onUpvote && onUpvote(thread.thread_id)}
        >
          {hasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
        </button>
        <span className="vote-count">{thread.upvotes}</span>
        <button
          type="button"
          className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
          title="Downvote"
          onClick={() => onDownvote && onDownvote(thread.thread_id)}
        >
          {hasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
        </button>
        <span className="vote-count">{thread.downvotes}</span>

        <span className="middot" aria-hidden="true">•</span>
        <span className="meta-quiet">{comments} comments</span>
      </div>
    </div>
  );
}
