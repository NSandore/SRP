// src/components/ForumCard.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';

const ForumCard = ({
  forum,
  userData,
  openMenuId,
  toggleMenu,
  handleSaveForum,
  handleDeleteForum,
  handleUpvoteClick,
  handleDownvoteClick,
  startEditingForum
}) => {
  // Determine vote status for this forum
  const hasUpvoted = forum.vote_type === 'up';
  const hasDownvoted = forum.vote_type === 'down';

  // Only admins can edit/delete forums (for this example)
  const canEditOrDelete = userData && Number(userData.role_id) === 7;

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

  return (
    <div key={forum.forum_id} className="forum-card" style={{ marginBottom: '1rem', position: 'relative' }}>
      {/* 3-dot menu icon */}
      <FaEllipsisV
        className="menu-icon"
        style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
        onClick={() => toggleMenu(forum.forum_id)}
      />
      {openMenuId === forum.forum_id && (
        <div
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
                          borderTop: '1px solid #eee'
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
          {userData && (
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
              alert(`Report forum with ID ${forum.forum_id}`);
              toggleMenu(null);
            }}
          >
            Report
          </button>
        </div>
      )}

      {/* Vote Row */}
      <div className="vote-row">
        <button
          type="button"
          className={`vote-button upvote-button ${hasUpvoted ? 'active' : ''}`}
          onClick={() => handleUpvoteClick(forum.forum_id)}
          title="Upvote"
          aria-label="Upvote"
        >
          {hasUpvoted ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
        </button>
        <span className="vote-count">{forum.upvotes}</span>
        <button
          type="button"
          className={`vote-button downvote-button ${hasDownvoted ? 'active' : ''}`}
          onClick={() => handleDownvoteClick(forum.forum_id)}
          title="Downvote"
          aria-label="Downvote"
        >
          {hasDownvoted ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
        </button>
        <span className="vote-count">{forum.downvotes}</span>
      </div>

      {/* Forum Details Link */}
      <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <h3 className="forum-title">{forum.name}</h3>
        <p className="forum-thread-count">{forum.thread_count || 0} Threads</p>
        <p className="forum-description">{forum.description}</p>
      </Link>

      {/* Edit/Delete actions */}
      {canEditOrDelete && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          <button
            className="edit-button"
            style={{ backgroundColor: '#ffa500', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
            onClick={() => startEditingForum(forum)}
          >
            Edit
          </button>
          <button
            className="delete-button"
            style={{ backgroundColor: '#ff6961', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
            onClick={() => handleDeleteForum(forum.forum_id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ForumCard;
