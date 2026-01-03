// src/components/ForumCard.js

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaEllipsisV } from 'react-icons/fa';

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
  const canEditOrDelete = userData && Number(userData.role_id) === 1;
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

  // State for ambassador submenu
  const [ambassadorCommunities, setAmbassadorCommunities] = useState([]);
  const [submenuForumId, setSubmenuForumId] = useState(null);

  // Fetch ambassador communities when the component mounts (if the user is an ambassador)
  useEffect(() => {
    if (userData && userData.is_ambassador === "1") {
      axios
        .get(`/api/fetch_ambassador_communities.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        })
        .then(response => {
          if (response.data.success) {
            setAmbassadorCommunities(response.data.communities);
          } else {
            console.error("Error fetching ambassador communities:", response.data.error);
          }
        })
        .catch(error => {
          console.error("Error fetching ambassador communities:", error);
        });
    }
  }, [userData]);

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

  // Meta data helpers
  const threadCount = forum.thread_count || 0;
  const lastUpdated = forum.updated_at || forum.created_at;

  return (
    <div
      key={forum.forum_id}
      className="forum-card card-lift"
      style={{ position: 'relative' }}
    >
      {/* 3-dot menu icon */}
      <FaEllipsisV
        className="menu-icon kebab-button"
        style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
        onClick={() => toggleMenu(forum.forum_id)}
        aria-haspopup="menu"
        aria-expanded={openMenuId === forum.forum_id}
      />
      {openMenuId === forum.forum_id && (
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: '30px',
            right: '8px',
            backgroundColor: 'var(--bg-card, var(--card-background))',
            border: '1px solid var(--card-border)',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10,
            width: '180px'
          }}
        >
          {/* Ambassador submenu: only show if the user is an ambassador */}
          {userData && userData.is_ambassador === "1" && (
            <div className="dropdown-item submenu-container">
              <div
                className="submenu-title"
                style={{ cursor: 'pointer', padding: '8px' }}
                onMouseEnter={() => setSubmenuForumId(forum.forum_id)}
                onMouseLeave={() => setSubmenuForumId(null)}
              >
                Add to University Feed
              </div>
              {submenuForumId === forum.forum_id && (
                <ul
                  className="submenu-list"
                  style={{ listStyle: 'none', padding: '0', margin: '0' }}
                >
                  {ambassadorCommunities.length > 0 ? (
                    ambassadorCommunities.map((community) => (
                      <li
                        key={community.community_id}
                        className="submenu-item"
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderTop: '1px solid var(--card-border)'
                        }}
                        onClick={() => {
                          console.log(
                            "Pinning forum", forum.forum_id,
                            "to community", community.community_id
                          );
                          axios
                            .post(
                              '/api/pin_to_community.php',
                              {
                                community_id: community.community_id,
                                item_id: forum.forum_id,
                                item_type: 'forum'
                              },
                              { withCredentials: true }
                            )
                            .then(response => {
                              if (response.data.success) {
                                alert('Forum pinned to community successfully!');
                                toggleMenu(null);
                                setSubmenuForumId(null);
                              } else {
                                alert('Error: ' + response.data.error);
                              }
                            })
                            .catch(error => {
                              console.error("Error pinning forum:", error);
                              alert('Error pinning forum');
                            });
                        }}
                      >
                        {community.name}
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: '6px 8px' }}>No communities found</li>
                  )}
                </ul>
              )}
            </div>
          )}
          {handleSaveForum && (
            <button
              className="dropdown-item"
              style={{
                width: '100%',
                border: 'none',
                background: 'none',
                padding: '8px',
                textAlign: 'left',
                cursor: 'pointer'
              }}
              onClick={() => {
                handleSaveForum(forum.forum_id, forum.saved);
              }}
            >
              {forum.saved ? 'Unsave' : 'Save'}
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
              cursor: 'pointer'
            }}
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
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'none',
                  padding: '8px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  startEditingForum(forum);
                  toggleMenu(null);
                }}
              >
                Edit
              </button>
              <button
                className="dropdown-item"
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'none',
                  padding: '8px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
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
        <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 className="forum-title" style={{ margin: 0 }}>{forum.name}</h3>
        </Link>
        <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <p className="forum-description" style={{ margin: 0 }}>{forum.description}</p>
        </Link>
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
