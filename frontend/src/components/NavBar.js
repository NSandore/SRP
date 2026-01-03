import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaEnvelope, FaBell, FaSearch, FaBars, FaTimes, FaSun, FaMoon } from 'react-icons/fa';
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
  onOpenDrawer,
  onCloseDrawer,
  onAnnouncementHeight,
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [notifList, setNotifList] = useState(notifications || []);
  const [fadeMap, setFadeMap] = useState({});
  const [globalAnnouncements, setGlobalAnnouncements] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  const unreadCount = notifList.filter(n => parseInt(n.is_read, 10) === 0).length;
  const accountMenuRef = useRef(null);
  const searchAreaRef = useRef(null);
  const searchToggleRef = useRef(null);
  const tickerRef = useRef(null);
  const buildAvatarSrc = (path) => {
    const fallback = '/uploads/avatars/DefaultAvatar.png';
    if (!path) return fallback;
    if (path.startsWith('http')) return path;
    return path.startsWith('/') ? path : `/uploads/avatars/${path}`;
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    try {
      localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    } catch (err) {
      // ignore storage issues
    }
  }, [isDarkTheme]);

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

  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const handleOutsideClick = (event) => {
      const withinSearch = searchAreaRef.current?.contains(event.target);
      const withinToggle = searchToggleRef.current?.contains(event.target);
      if (!withinSearch && !withinToggle) {
        setIsMobileSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobileSearchOpen]);

  const sanitizeText = (value) => {
    const clean = DOMPurify.sanitize(value || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return clean.replace(/\s+/g, ' ').trim();
  };

  const dismissalStorageKey = useMemo(
    () => `dismissedAnnouncements:${userData?.user_id || 'anon'}`,
    [userData?.user_id]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissalStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDismissedAnnouncements(parsed);
        }
      }
    } catch (err) {
      // ignore storage issues
    }
  }, [dismissalStorageKey]);

  const fetchGlobalAnnouncements = async () => {
    try {
      const res = await axios.get('/api/fetch_global_announcements.php');
      if (res.data?.success && Array.isArray(res.data.announcements)) {
        const normalized = res.data.announcements
          .map((a) => ({
            id: a.announcement_id || a.id,
            title: sanitizeText(a.title),
            body: sanitizeText(a.body),
            type: a.announcement_type || 'general'
          }))
          .filter((a) => a.id && (a.title || a.body));
        const filtered = normalized.filter((a) => !dismissedAnnouncements.includes(a.id));
        setGlobalAnnouncements(filtered);
      } else {
        setGlobalAnnouncements([]);
      }
    } catch (err) {
      setGlobalAnnouncements([]);
    }
  };

  useEffect(() => {
    fetchGlobalAnnouncements();
    const interval = setInterval(fetchGlobalAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announcementText = globalAnnouncements
    .map((a) => [a.title, a.body].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('   •   ');

  const dismissAllAnnouncements = () => {
    const ids = globalAnnouncements.map((a) => a.id).filter(Boolean);
    const merged = Array.from(new Set([...(dismissedAnnouncements || []), ...ids]));
    setDismissedAnnouncements(merged);
    try {
      localStorage.setItem(dismissalStorageKey, JSON.stringify(merged));
    } catch (err) {
      // ignore storage failure
    }
    setGlobalAnnouncements([]);
    onAnnouncementHeight?.(0);
  };

  // Initialize jQuery newsticker
  useEffect(() => {
    if (!tickerRef.current || !announcementText) {
      if (tickerRef.current && window?.jQuery) {
        const $el = window.jQuery(tickerRef.current);
        $el.removeClass('eocjs-newsticker-active').empty();
      }
      return;
    }
    const $ = window?.jQuery;
    if (!$ || !$.fn?.eocjsNewsticker) return;
    const $el = $(tickerRef.current);
    $el.removeClass('eocjs-newsticker-active').empty().text(announcementText);
    $el.eocjsNewsticker({
      speed: 25,
      divider: ' ••• ',
      direction: 'ltr'
    });
    return () => {
      $el.removeClass('eocjs-newsticker-active').empty();
    };
  }, [announcementText]);

  // When dismiss list changes, re-filter announcements already loaded
  useEffect(() => {
    setGlobalAnnouncements((prev) => prev.filter((a) => !dismissedAnnouncements.includes(a.id)));
  }, [dismissedAnnouncements]);

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

  const handleLogoClick = (e) => {
    e.preventDefault();
    closeDrawerIfOpen();
    const targetFeed = localStorage.getItem('defaultFeed') || 'explore';
    setActiveFeed(targetFeed);
    if (targetFeed === 'info') {
      setActiveSection('info');
      navigate('/info');
    } else if (targetFeed === 'yourFeed') {
      setActiveSection('home');
      navigate('/home?tab=feed');
    } else {
      setActiveSection('home');
      navigate('/home?tab=explore');
    }
  };

  const goToSettings = () => {
    setAccountMenuVisible(false);
    closeDrawerIfOpen();
    navigate('/settings');
  };

  const toggleTheme = () => {
    setIsDarkTheme((prev) => !prev);
  };

  const closeDrawerIfOpen = () => {
    if (onCloseDrawer) onCloseDrawer();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileSearchOpen(false);
    }
  };

  const handleHamburgerClick = () => {
    if (isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
      // allow layout to settle before showing drawer so it appears immediately
      setTimeout(() => {
        if (onOpenDrawer) onOpenDrawer();
      }, 0);
    } else if (onOpenDrawer) {
      onOpenDrawer();
    }
  };

  const handleAnnouncementMount = (el) => {
    if (!el) {
      onAnnouncementHeight?.(0);
      return;
    }
    const height = el.getBoundingClientRect().height;
    onAnnouncementHeight?.(height);
  };

  return (
    <>
    <nav className={`nav-bar ${isMobileSearchOpen ? 'search-open' : ''}`} aria-label="Top Navigation Bar">
      {/* Left: hamburger + wordmark */}
      <div className="nav-left">
        <button
          type="button"
          className="nav-icon-button hamburger-button mobile-only"
          onClick={handleHamburgerClick}
          aria-label="Open navigation menu"
        >
          <FaBars className="nav-icon" aria-hidden="true" />
        </button>
        <Link
          to="/home"
          className="brand-button"
          aria-label="Go to Home"
          onClick={handleLogoClick}
          >
          <span className="brand-title">StudentSphere</span>
        </Link>
      </div>

      {/* Center: Pill search */}
      <div
        className={`nav-center ${isMobileSearchOpen ? 'search-open' : ''}`}
        ref={searchAreaRef}
      >
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
            {isMobileSearchOpen && (
              <button
                type="button"
                className="search-button mobile-only"
                aria-label="Close search"
                onClick={() => setIsMobileSearchOpen(false)}
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right: Icons and avatar */}
      <div className="nav-right">
        <button
          type="button"
          className="nav-icon-button mobile-only"
          aria-label={isMobileSearchOpen ? 'Close search' : 'Open search'}
          ref={searchToggleRef}
          onClick={() =>
            setIsMobileSearchOpen((prev) => {
              const next = !prev;
              if (next) closeDrawerIfOpen();
              return next;
            })
          }
        >
          {isMobileSearchOpen ? <FaTimes className="nav-icon" /> : <FaSearch className="nav-icon" />}
        </button>
        <div className="nav-icons" role="group" aria-label="Quick actions">
          {userData && (
            <>
              {/* Messages link */}
              <Link
                to="/messages"
                aria-label="Messages"
                className="messages-link"
                onClick={closeDrawerIfOpen}
              >
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
                  onClick={(e) => {
                    closeDrawerIfOpen();
                    toggleNotifications(e);
                  }}
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
                                <img
                                  src={buildAvatarSrc(notif.avatar_path)}
                                  alt={`${notif.first_name || 'User'} ${notif.last_name || ''}`.trim()}
                                  className="notification-avatar"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = buildAvatarSrc(null);
                                  }}
                                />
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
              onClick={() => {
                closeDrawerIfOpen();
                setAccountMenuVisible(!accountMenuVisible);
              }}
              tabIndex={0}
              role="button"
              aria-haspopup="true"
              aria-expanded={accountMenuVisible}
              aria-controls="account-menu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  closeDrawerIfOpen();
                  setAccountMenuVisible(!accountMenuVisible);
                }
              }}
            >
            <img
              src={buildAvatarSrc(userData.avatar_path)}
              alt="User Avatar"
              className="user-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = buildAvatarSrc(null);
              }}
            />
              {accountMenuVisible && (
                <div id="account-menu" className="account-menu" role="menu" aria-label="Account Menu">
                  <div
                    className="account-menu-item"
                    onClick={() => {
                      closeDrawerIfOpen();
                      goToSettings();
                    }}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        closeDrawerIfOpen();
                        goToSettings();
                      }
                    }}
                  >
                    Account Settings
                  </div>
                  <button
                    type="button"
                    className="account-menu-item theme-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    role="menuitem"
                    aria-pressed={isDarkTheme}
                    aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTheme();
                      }
                    }}
                  >
                    <FaSun className={`theme-icon ${!isDarkTheme ? 'active' : ''}`} aria-hidden="true" />
                    <div className={`theme-toggle-switch ${isDarkTheme ? 'on' : 'off'}`}>
                      <div className="theme-toggle-thumb" />
                    </div>
                    <FaMoon className={`theme-icon ${isDarkTheme ? 'active' : ''}`} aria-hidden="true" />
                    <span className="sr-only">{isDarkTheme ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                  <div
                    className="account-menu-item"
                    onClick={() => {
                      closeDrawerIfOpen();
                      handleLogout();
                    }}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        closeDrawerIfOpen();
                        handleLogout();
                      }
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
          <button
            className="nav-button"
            onClick={() => {
              closeDrawerIfOpen();
              onOpenLogin();
            }}
          >
            Login
          </button>
        )}
      </div>
    </nav>
    {Boolean(announcementText) && (
      <div className="global-announcement-bar" aria-live="polite" ref={handleAnnouncementMount}>
        <div
          className="global-announcement-ticker"
          ref={tickerRef}
        >
          {announcementText}
        </div>
        <button
          type="button"
          className="global-announcement-dismiss"
          aria-label="Dismiss announcement banner"
          onClick={() => {
            setGlobalAnnouncements([]);
            onAnnouncementHeight?.(0);
          }}
        >
          ×
        </button>
      </div>
    )}
    </>
  );
}

export default NavBar;
