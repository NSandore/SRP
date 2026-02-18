// src/components/ForumCard.js

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaEllipsisV } from 'react-icons/fa';
import { isSuperAdmin } from '../constants/roles';
import { buildAvatarSrc } from '../utils/avatar';

const ForumCard = ({
  forum,
  userData,
  openMenuId,
  toggleMenu,
  onReport,
  handleSaveForum,
  handleDeleteForum,
  handleUpvoteClick,
  handleDownvoteClick,
  startEditingForum
}) => {
  // Only admins can edit/delete forums (for this example)
  const canEditOrDelete = userData && isSuperAdmin(userData.role_id);
  const ambassadorCommunities = Array.isArray(userData?.ambassador_communities)
    ? userData.ambassador_communities
        .map((community) => ({
          community_id: String(community?.community_id ?? community?.id ?? ''),
          name: String(community?.name ?? 'Community'),
        }))
        .filter((community) => community.community_id)
    : [];
  const canPinToCommunity = ambassadorCommunities.length > 0;
  const baseSaved = Boolean(forum?.saved);
  const [savedStatus, setSavedStatus] = useState(baseSaved);
  useEffect(() => {
    setSavedStatus(baseSaved);
  }, [baseSaved]);

  useEffect(() => {
    if (openMenuId !== forum.forum_id || !userData?.user_id) return;
    const loadSavedStatus = async () => {
      try {
        const resp = await axios.get('/api/save_check.php', {
          params: { user_id: userData.user_id, item_type: 'forum', item_id: forum.forum_id },
          withCredentials: true,
        });
        const saved = Boolean(resp.data?.saved ?? resp.data?.is_saved);
        setSavedStatus(saved);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('save_check failed for forum', err);
      }
    };
    loadSavedStatus();
  }, [openMenuId, forum.forum_id, userData?.user_id]);

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

  const [isPinSubmenuOpen, setIsPinSubmenuOpen] = useState(false);

  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) toggleMenu(null);
    };
    if (openMenuId === forum.forum_id) {
      document.addEventListener('mousedown', onClick);
      document.addEventListener('touchstart', onClick);
    }
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
    };
  }, [openMenuId, forum.forum_id, toggleMenu]);

  useEffect(() => {
    if (openMenuId !== forum.forum_id) {
      setIsPinSubmenuOpen(false);
    }
  }, [openMenuId, forum.forum_id]);

  const handlePinForum = async (communityId) => {
    try {
      const response = await axios.post(
        '/api/pin_to_community.php',
        {
          community_id: communityId,
          item_id: forum.forum_id,
          item_type: 'forum'
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        alert(response.data.already_pinned ? 'Forum is already pinned to that community.' : 'Forum pinned to community.');
        toggleMenu(null);
        setIsPinSubmenuOpen(false);
      } else {
        alert(`Error: ${response.data.error || 'Unable to pin forum.'}`);
      }
    } catch (error) {
      console.error('Error pinning forum:', error);
      alert('Error pinning forum');
    }
  };

  // Meta data helpers
  const threadCount = forum.thread_count || 0;
  const lastUpdated = forum.updated_at || forum.created_at;

  return (
    <div
      key={forum.forum_id}
      className="forum-card card-lift"
      style={{ position: 'relative' }}
    >
      {openMenuId === forum.forum_id && (
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{ position: 'absolute', top: '30px', right: '8px', zIndex: 10 }}
        >
          {canPinToCommunity && (
            <div
              className="dropdown-item"
              onMouseEnter={() => setIsPinSubmenuOpen(true)}
              onMouseLeave={() => setIsPinSubmenuOpen(false)}
              style={{ position: 'relative' }}
            >
              Pin to Community
              {isPinSubmenuOpen && (
                <ul className="submenu-list submenu-right">
                  {ambassadorCommunities.map((community) => (
                    <li
                      key={community.community_id}
                      className="submenu-item"
                      onClick={() => handlePinForum(community.community_id)}
                    >
                      {community.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {handleSaveForum && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleSaveForum(forum.forum_id, savedStatus);
                setSavedStatus((prev) => !prev);
                toggleMenu(null);
              }}
            >
              {savedStatus ? 'Unsave' : 'Save'}
            </button>
          )}
          <button
            className="dropdown-item"
            onClick={() => {
              if (onReport) {
                onReport(forum);
              }
              toggleMenu(null);
            }}
          >
            Report
          </button>
          {canEditOrDelete && (
            <>
              <button
                className="dropdown-item"
                onClick={() => {
                  startEditingForum(forum);
                  toggleMenu(null);
                }}
              >
                Edit
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  handleDeleteForum(forum.forum_id);
                  toggleMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Left block: title, description, meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
        <div className="forum-title-row">
          <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="forum-title" style={{ margin: 0 }}>{forum.name}</h3>
          </Link>
          <button
            type="button"
            className="kebab-button"
            aria-haspopup="menu"
            aria-expanded={openMenuId === forum.forum_id}
            onClick={() => toggleMenu(forum.forum_id)}
            style={{ cursor: 'pointer' }}
          >
            <FaEllipsisV className="menu-icon" />
          </button>
        </div>
        {Array.isArray(forum.tags) && forum.tags.length > 0 && (
          <div className="chips-row" style={{ marginTop: 0 }}>
            {forum.tags.map((tag) => (
              <span key={tag} className="chip tag-chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <p className="forum-description" style={{ margin: 0 }}>{forum.description}</p>
        </Link>
        {forum.created_by && (
          <div className="meta-quiet" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Created by</span>
            <img
              src={buildAvatarSrc(forum.created_by_avatar_path)}
              alt={`${forum.created_by_first_name || 'User'} ${forum.created_by_last_name || ''}`}
              style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = buildAvatarSrc(null);
              }}
            />
            <Link to={`/user/${forum.created_by}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>
              {forum.created_by_first_name || 'User'} {forum.created_by_last_name || ''}
            </Link>
          </div>
        )}
        <div className="meta-row" style={{ marginTop: '4px' }}>
          <span className="meta-quiet">{threadCount} threads</span>
          <span className="middot">·</span>
          <span className="meta-quiet">Last updated {lastUpdated ? timeAgo(lastUpdated) : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default ForumCard;
