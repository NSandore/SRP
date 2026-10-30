import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaEnvelope, FaBell, FaSearch, FaBars, FaTimes, FaSun, FaMoon, FaGlobe, FaCheck } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import axios from 'axios';
import { buildAvatarSrc } from '../utils/avatar';
import { LANGUAGE_OPTIONS, useLanguage } from '../i18n/LanguageContext';
import './LanguageSwitcher.css';

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
  isDrawerOpen,
  onAnnouncementHeight,
}) {
  const navigate = useNavigate();
  const { language, locale, setLanguage, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
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
  const languageSwitcherRef = useRef(null);
  const languageTriggerRef = useRef(null);
  const languageMenuRef = useRef(null);
  const tickerRef = useRef(null);
  const announcementBarRef = useRef(null);
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
    if (!isLanguageMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!languageSwitcherRef.current?.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
        languageTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLanguageMenuOpen]);

  const focusLanguageOption = (index) => {
    const options = languageMenuRef.current?.querySelectorAll('[role="menuitemradio"]');
    options?.[index]?.focus();
  };

  const openLanguageMenuFromKeyboard = (index) => {
    closeDrawerIfOpen();
    setAccountMenuVisible(false);
    if (isNotificationsOpen) toggleNotifications();
    setIsLanguageMenuOpen(true);
    window.requestAnimationFrame(() => focusLanguageOption(index));
  };

  const handleLanguageOptionKeyDown = (event) => {
    const options = Array.from(languageMenuRef.current?.querySelectorAll('[role="menuitemradio"]') || []);
    const currentIndex = options.indexOf(event.currentTarget);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else return;

    event.preventDefault();
    options[nextIndex]?.focus();
  };

  const chooseLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    setIsLanguageMenuOpen(false);
    window.requestAnimationFrame(() => languageTriggerRef.current?.focus());
  };

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

  const goToDonation = () => {
    setAccountMenuVisible(false);
    closeDrawerIfOpen();
    navigate('/donate');
  };

  const toggleTheme = () => {
    setIsDarkTheme((prev) => !prev);
  };

  const closeDrawerIfOpen = () => {
    if (onCloseDrawer) onCloseDrawer();
  };

  const extractFirstHref = (html = '') => {
    const safeHtml = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] });
    const match = safeHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
    return match ? match[1] : '';
  };

  const notificationTarget = (notif) => {
    const linkedHref = extractFirstHref(notif?.message || '');
    if (linkedHref) return linkedHref;

    const actorId = notif?.actor_user_id;
    switch (notif?.notification_type) {
      case 'message':
        return actorId ? `/messages?user=${actorId}` : '/messages';
      case 'connection':
        return actorId ? `/user/${actorId}` : '/messages';
      case 'follow':
        return actorId ? `/user/${actorId}` : '';
      case 'verification_request':
        return notif?.reference_id ? `/admin/verifications?request_id=${notif.reference_id}` : '/admin/verifications';
      case 'verification_result':
        return '/profile';
      case 'event':
        return notif?.reference_id ? `/events-feed?event=${encodeURIComponent(notif.reference_id)}` : '/events-feed';
      default:
        return '';
    }
  };

  const handleNotificationNavigate = (notif) => {
    const target = notificationTarget(notif);
    if (!target) return;
    closeDrawerIfOpen();
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }
    navigate(target);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileSearchOpen(false);
    }
  };

  const handleHamburgerClick = () => {
    if (isDrawerOpen) {
      if (onCloseDrawer) onCloseDrawer();
      return;
    }
    if (isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
      // allow layout to settle before showing drawer so it appears immediately
      setTimeout(() => {
        if (onOpenDrawer) onOpenDrawer();
      }, 0);
      return;
    }
    if (onOpenDrawer) onOpenDrawer();
  };

  useEffect(() => {
    if (!onAnnouncementHeight) return;
    if (!announcementText) {
      onAnnouncementHeight(0);
      return;
    }
    const el = announcementBarRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      const height = el.getBoundingClientRect().height;
      onAnnouncementHeight(height);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [announcementText, onAnnouncementHeight]);

  return (
    <>
    <nav className={`nav-bar ${isMobileSearchOpen ? 'search-open' : ''}`} aria-label={t('nav.top')}>
      {/* Left: hamburger + wordmark */}
      <div className="nav-left">
        <button
          type="button"
          className="nav-icon-button hamburger-button mobile-only"
          onClick={handleHamburgerClick}
          aria-label={t('nav.openMenu')}
        >
          <FaBars className="nav-icon" aria-hidden="true" />
        </button>
        <Link
          to="/home"
          className="brand-button"
          aria-label={t('nav.goHome')}
          onClick={handleLogoClick}
          >
          <img
            src="/uploads/logos/StudentSphere.png"
            alt="StudentSphere logo"
            className="brand-logo"
          />
          <span className="brand-title">StudentSphere</span>
        </Link>
      </div>

      {/* Center: Pill search */}
      <div
        className={`nav-center ${isMobileSearchOpen ? 'search-open' : ''}`}
        ref={searchAreaRef}
      >
        <form className="search-form" role="search" onSubmit={handleSearch} aria-label={t('nav.siteSearch')}>
          <div className="search-container" aria-live="polite" data-tour="search">
            <input
              type="text"
              placeholder={t('nav.searchPlaceholder')}
              aria-label={t('nav.searchPlatform')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button" aria-label={t('nav.search')}>
              <FaSearch size={14} />
            </button>
            {isMobileSearchOpen && (
              <button
                type="button"
                className="search-button mobile-only"
                aria-label={t('nav.closeSearch')}
                onClick={() => setIsMobileSearchOpen(false)}
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right: Icons and avatar */}
      <div className={`nav-right${!userData ? ' nav-right--guest' : ''}`}>
        <button
          type="button"
          className="nav-icon-button mobile-only"
          aria-label={isMobileSearchOpen ? t('nav.closeSearch') : t('nav.openSearch')}
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
        <div
          className="language-switcher"
          ref={languageSwitcherRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsLanguageMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            className="nav-icon-button language-switcher-trigger"
            ref={languageTriggerRef}
            onClick={() => {
              closeDrawerIfOpen();
              setAccountMenuVisible(false);
              if (isNotificationsOpen) toggleNotifications();
              setIsLanguageMenuOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openLanguageMenuFromKeyboard(event.key === 'ArrowDown' ? 0 : LANGUAGE_OPTIONS.length - 1);
              }
            }}
            aria-label={t('language.choose')}
            title={t('language.choose')}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
            aria-controls="platform-language-menu"
          >
            <FaGlobe className="nav-icon language-switcher-icon" aria-hidden="true" />
          </button>
          <div
            id="platform-language-menu"
            ref={languageMenuRef}
            className={`language-switcher-menu${isLanguageMenuOpen ? ' open' : ''}`}
            role="menu"
            aria-label={t('language.choose')}
            aria-hidden={!isLanguageMenuOpen}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`language-switcher-option${language === option.value ? ' selected' : ''}`}
                role="menuitemradio"
                aria-checked={language === option.value}
                tabIndex={isLanguageMenuOpen ? 0 : -1}
                onClick={() => chooseLanguage(option.value)}
                onKeyDown={handleLanguageOptionKeyDown}
              >
                <span>{option.label}</span>
                <FaCheck className="language-switcher-check" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="nav-icons" role="group" aria-label={t('nav.quickActions')}>
          {userData && (
            <>
              {/* Messages link */}
              <Link
                to="/messages"
                aria-label={t('nav.messages')}
                className="messages-link"
                onClick={closeDrawerIfOpen}
              >
                <div className="notification-container">
                  <FaEnvelope className="nav-icon" title={t('nav.messages')} aria-hidden="true" />
                  {unreadMessages > 0 && (
                    <span className="notification-badge" aria-label={t('nav.unreadMessages', { count: unreadMessages })}>{unreadMessages}</span>
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
                  aria-label={t('nav.notifications')}
                  title={t('nav.notifications')}
                >
                  <FaBell className="nav-icon" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="notification-badge" aria-label={t('nav.unreadNotifications', { count: unreadCount })}>{unreadCount}</span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div id="notifications-dropdown" className="notifications-dropdown" role="dialog" aria-label={t('nav.notifications')}>
                    <div className="notifications-header">
                      <div className="notifications-heading">
                        <p className="notifications-title">{t('nav.notifications')}</p>
                        <p className="notifications-subtitle">
                          {unreadCount > 0 ? t('nav.unread', { count: unreadCount }) : t('nav.allCaughtUp')}
                        </p>
                      </div>
                      {notifList.length > 0 && (
                        <button
                          type="button"
                          className="notifications-mark-read pill-button"
                          onClick={markAllAsRead}
                        >
                          {t('nav.markAllRead')}
                        </button>
                      )}
                    </div>
                    <div className="notifications-body">
                      {notifList.length === 0 ? (
                        <div className="notifications-empty">
                          <p>{t('nav.caughtUpMessage')}</p>
                          <small>{t('nav.newItemsMessage')}</small>
                        </div>
                      ) : (
                        <ul>
                          {notifList.map((notif) => {
                            const createdAt = new Date(notif.created_at);
                            const target = notificationTarget(notif);
                            return (
                              <li
                                key={notif.notification_id}
                                className={`notification-item ${notif.is_read === "0" ? 'unread' : ''} ${fadeMap[notif.notification_id] ? 'fade-out' : ''}`}
                                onClick={() => handleNotificationNavigate(notif)}
                                role={target ? 'button' : undefined}
                                tabIndex={target ? 0 : undefined}
                                style={{ cursor: target ? 'pointer' : 'default' }}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && target) {
                                    e.preventDefault();
                                    handleNotificationNavigate(notif);
                                  }
                                }}
                              >
                                <div className="notification-body">
                                  <img
                                    src={buildAvatarSrc(notif.avatar_path)}
                                    alt={`${notif.first_name || t('nav.userAvatar')} ${notif.last_name || ''}`.trim()}
                                    className="notification-avatar"
                                    role={notif.actor_user_id ? 'button' : undefined}
                                    tabIndex={notif.actor_user_id ? 0 : undefined}
                                    style={{ cursor: notif.actor_user_id ? 'pointer' : undefined }}
                                    onClick={(e) => {
                                      if (!notif.actor_user_id) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      closeDrawerIfOpen();
                                      navigate(`/user/${notif.actor_user_id}`);
                                    }}
                                    onKeyDown={(e) => {
                                      if (!notif.actor_user_id) return;
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        closeDrawerIfOpen();
                                        navigate(`/user/${notif.actor_user_id}`);
                                      }
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = buildAvatarSrc(null);
                                    }}
                                  />
                                  <div
                                    className="notification-copy"
                                    onClick={(e) => {
                                      const anchor = e.target.closest('a');
                                      if (anchor) {
                                        const href = anchor.getAttribute('href');
                                        if (href) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          closeDrawerIfOpen();
                                          if (/^https?:\/\//i.test(href)) {
                                            window.location.href = href;
                                          } else {
                                            navigate(href);
                                          }
                                        }
                                      }
                                    }}
                                  >
                                    <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notif.message) }} />
                                    <time className="notification-time" dateTime={createdAt.toISOString()}>
                                      {createdAt.toLocaleString(locale)}
                                    </time>
                                  </div>
                                  <button
                                    type="button"
                                    className="notification-dismiss"
                                    aria-label={t('nav.dismissNotification')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissNotification(notif.notification_id);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
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
              alt={t('nav.userAvatar')}
              className="user-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = buildAvatarSrc(null);
              }}
            />
              {accountMenuVisible && (
                <div id="account-menu" className="account-menu" role="menu" aria-label={t('nav.accountMenu')}>
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
                    {t('nav.accountSettings')}
                  </div>
                  {/*
                  <div
                    className="account-menu-item"
                    onClick={() => {
                      closeDrawerIfOpen();
                      goToDonation();
                    }}
                    tabIndex={0}
                    role="menuitem"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        closeDrawerIfOpen();
                        goToDonation();
                      }
                    }}
                  >
                    Support the Project
                  </div>
                  */}
                  <button
                    type="button"
                    className="account-menu-item theme-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    role="menuitem"
                    aria-pressed={isDarkTheme}
                    aria-label={isDarkTheme ? t('nav.switchLight') : t('nav.switchDark')}
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
                    <span className="sr-only">{isDarkTheme ? t('nav.lightMode') : t('nav.darkMode')}</span>
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
                    {t('nav.logOut')}
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
            {t('nav.logIn')}
          </button>
        )}
      </div>
    </nav>
    {Boolean(announcementText) && (
      <div className="global-announcement-bar" aria-live="polite" ref={announcementBarRef}>
        <div
          className="global-announcement-ticker"
          ref={tickerRef}
        >
          {announcementText}
        </div>
        <button
          type="button"
          className="global-announcement-dismiss"
          aria-label={t('nav.dismissAnnouncement')}
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
