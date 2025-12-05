import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaEnvelope, FaBell, FaSearch } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import axios from 'axios';

//

function NavBar({
  onOpenLogin,
  activeFeed,
  setActiveFeed,
  activeSection,
  userData,
  accountMenuVisible,
  setActiveSection,
  setAccountMenuVisible,
  handleLogout,
  toggleNotifications,
  notifications,
  isNotificationsOpen,
  notificationRef,
  markAllAsRead,
  unreadMessages,
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifList, setNotifList] = useState(notifications || []);
  const [fadeMap, setFadeMap] = useState({});
  const unreadCount = notifList.filter(n => parseInt(n.is_read, 10) === 0).length;
  const accountMenuRef = useRef(null);

  useEffect(() => {
    // Apply saved theme preference
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!accountMenuVisible) return;

    function handleClickOutside(event) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuVisible(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuVisible, setAccountMenuVisible]);

  useEffect(() => {
    setNotifList(notifications || []);
    setFadeMap({});
  }, [notifications]);

  const handleDismissNotification = async (id) => {
    setFadeMap((prev) => ({ ...prev, [id]: true }));
    try {
      await axios.post(
        '/api/delete_notification.php',
        { notification_id: id },
        { withCredentials: true }
      );
    } catch (err) {
      // ignore failure for UX; local removal still happens
    }
    setTimeout(() => {
      setNotifList((prev) => prev.filter((n) => n.notification_id !== id));
    }, 200);
  };

  const handleSectionClick = (section) => {
    setActiveSection(section);
    if (section === 'info') {
      setActiveFeed('info');
    } else {
      setActiveFeed('yourFeed');
    }
    navigate(`/${section}`);
  };

  const goToSettings = () => {
    setAccountMenuVisible(false);
    navigate('/settings');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="nav-bar" aria-label="Top Navigation Bar">
      {/* Left: Wordmark button linking to /home */}
      <div className="nav-left">
        <Link
          to="/home"
          className="brand-button"
          aria-label="Go to Home"
        >
          <span className="brand-title">StudentSphere</span>
        </Link>
      </div>

      {/* Center: Pill search */}
      <div className="nav-center">
        <form className="search-form" role="search" onSubmit={handleSearch} aria-label="Site Search">
          <div className="search-container" aria-live="polite">
            <input
              type="text"
              placeholder="Search forums, posts, people…"
              aria-label="Search StudentSphere"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button" aria-label="Search">
              <FaSearch size={14} />
            </button>
          </div>
        </form>
      </div>

      {/* Right: Icons and avatar */}
      <div className="nav-right">
        <div className="nav-icons" role="group" aria-label="Quick actions">
          {userData && (
            <>
              {/* Messages link */}
              <Link to="/messages" aria-label="Messages" className="messages-link">
                <div className="notification-container">
                  <FaEnvelope className="nav-icon" title="Messages" aria-hidden="true" />
                  {unreadMessages > 0 && (
                    <span className="notification-badge" aria-label={`${unreadMessages} unread messages`}>{unreadMessages}</span>
                  )}
                </div>
              </Link>

              {/* Notifications */}
              <div className="notification-container" ref={notificationRef}>
                <button
                  type="button"
                  className="nav-icon-button"
                  onClick={toggleNotifications}
                  aria-haspopup="true"
                  aria-expanded={isNotificationsOpen}
                  aria-controls="notifications-dropdown"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <FaBell className="nav-icon" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>{unreadCount}</span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div id="notifications-dropdown" className="notifications-dropdown" role="dialog" aria-label="Notifications">
                    <h4>Notifications</h4>
                    {notifList.length === 0 ? (
                      <p>No notifications</p>
                    ) : (
                      <>
                        <ul>
                          {notifList.map((notif) => (
                            <li
                              key={notif.notification_id}
                              className={`notification-item ${notif.is_read === "0" ? 'unread' : ''} ${fadeMap[notif.notification_id] ? 'fade-out' : ''}`}
                            >
                              <div className="notification-body">
                                {notif.avatar_path ? (
                                  <img
                                    src={notif.avatar_path.startsWith('http') ? notif.avatar_path : `http://172.16.11.133${notif.avatar_path}`}
                                    alt={`${notif.first_name || 'User'} ${notif.last_name || ''}`.trim()}
                                    className="notification-avatar"
                                  />
                                ) : null}
                                <div className="notification-copy">
                                  <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notif.message) }} />
                                  <small>{new Date(notif.created_at).toLocaleString()}</small>
                                </div>
                                <button
                                  type="button"
                                  className="notification-dismiss"
                                  aria-label="Dismiss notification"
                                  onClick={() => handleDismissNotification(notif.notification_id)}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button className="mark-read-button pill-button" onClick={markAllAsRead}>
                          Mark All as Read
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {userData && (
            <div
              className="account-settings"
              ref={accountMenuRef}
              onClick={() => setAccountMenuVisible(!accountMenuVisible)}
              tabIndex={0}
              role="button"
              aria-haspopup="true"
              aria-expanded={accountMenuVisible}
              aria-controls="account-menu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setAccountMenuVisible(!accountMenuVisible);
                }
              }}
            >
              {(() => {
                const apiBase = 'http://172.16.11.133';
                const defaultAvatar = '/uploads/avatars/DefaultAvatar.png';
                const src = userData.avatar_path
                  ? (userData.avatar_path.startsWith('http')
                      ? userData.avatar_path
                      : `${apiBase}${userData.avatar_path}`)
                  : `${apiBase}${defaultAvatar}`;
                return (
                  <img
                    src={src}
                    alt="User Avatar"
                    className="user-avatar"
                  />
                );
              })()}
              {accountMenuVisible && (
                <div id="account-menu" className="account-menu" role="menu" aria-label="Account Menu">
                  <div
                    className="account-menu-item"
                    onClick={goToSettings}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') goToSettings();
                    }}
                  >
                    Account Settings
                  </div>
                  <div
                    className="account-menu-item"
                    onClick={handleLogout}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleLogout();
                    }}
                  >
                    Log Out
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {!userData && (
          <button className="nav-button" onClick={onOpenLogin}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
}

export default NavBar;
