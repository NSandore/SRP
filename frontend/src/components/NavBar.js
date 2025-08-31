import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaEnvelope, FaBell, FaSearch, FaMoon, FaSun } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import axios from 'axios';

//

function NavBar({
  setStep,
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
  const [suggestions, setSuggestions] = useState({ users: [], forums: [], threads: [], tags: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const unreadCount = notifications.filter(n => parseInt(n.is_read, 10) === 0).length;
  const accountMenuRef = useRef(null);

  useEffect(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
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

  const toggleDarkMode = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowSuggestions(false);
      setSuggestions({ users: [], forums: [], threads: [], tags: [] });
      return;
    }
    const controller = new AbortController();
    axios
      .get(`/api/search.php?q=${encodeURIComponent(searchQuery.trim())}&limit=5`, {
        signal: controller.signal,
      })
      .then((res) => {
        setSuggestions(res.data);
        setShowSuggestions(true);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Search error:', err);
        }
      });
    return () => controller.abort();
  }, [searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSuggestionClick = (path) => {
    setShowSuggestions(false);
    setSearchQuery('');
    navigate(path);
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
              onFocus={() => setShowSuggestions(true)}
            />
            <button type="submit" className="search-button" aria-label="Search">
              <FaSearch size={14} />
            </button>
          </div>
          {showSuggestions && (
            <div className="search-suggestions" role="listbox">
              {suggestions.users.map((u) => (
                <div
                  key={`u${u.user_id}`}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(`/user/${u.user_id}`)}
                  role="option"
                >
                  @{u.first_name} {u.last_name}
                </div>
              ))}
              {suggestions.forums.map((f) => (
                <div
                  key={`f${f.forum_id}`}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(`/info/forum/${f.forum_id}`)}
                  role="option"
                >
                  {f.name}
                </div>
              ))}
              {suggestions.threads.map((t) => (
                <div
                  key={`t${t.thread_id}`}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(`/info/forum/${t.forum_id}/thread/${t.thread_id}`)}
                  role="option"
                >
                  {t.title}
                </div>
              ))}
              {suggestions.tags.map((tag) => (
                <div
                  key={`tag${tag}`}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(`/search?q=%23${tag}`)}
                  role="option"
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Right: Icons and avatar */}
      <div className="nav-right">
        <div className="nav-icons" role="group" aria-label="Quick actions">
          {/* Dark Mode Toggle */}
          <button
            className="nav-icon-button dark-mode-toggle"
            onClick={toggleDarkMode}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? <FaSun className="nav-icon" /> : <FaMoon className="nav-icon" />}
          </button>

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
                {notifications.length === 0 ? (
                  <p>No notifications</p>
                ) : (
                  <>
                    <ul>
                      {notifications.map((notif) => (
                        <li
                          key={notif.notification_id}
                          className={`notification-item ${notif.is_read === "0" ? 'unread' : ''}`}
                        >
                          <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notif.message) }} />
                          <small>{new Date(notif.created_at).toLocaleString()}</small>
                        </li>
                      ))}
                    </ul>
                    <button className="mark-read-button" onClick={markAllAsRead}>
                      Mark All as Read
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

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
              {userData.avatar_path ? (
                <img
                  src={`http://172.16.11.133${userData.avatar_path}`}
                  alt="User Avatar"
                  className="user-avatar"
                />
              ) : (
                <FaUserCircle className="nav-icon" title="Account Menu" aria-hidden="true" />
              )}
              {accountMenuVisible && (
                <div id="account-menu" className="account-menu" role="menu" aria-label="Account Menu">
                  <div
                    className="account-menu-item"
                    onClick={() => alert('Account Settings')}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') alert('Account Settings');
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
          <button className="nav-button" onClick={() => setStep(2)}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
}

export default NavBar;
