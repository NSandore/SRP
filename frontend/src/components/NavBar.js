import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaHome,
  FaBookmark,
  FaUserCircle,
  FaPeopleCarry,
  FaUsers,
  FaEnvelope,
  FaBell,
  FaSearch,
  FaMoon,
  FaSun
} from 'react-icons/fa';
import { BiInfoCircle } from 'react-icons/bi';
import { RiMedalFill } from 'react-icons/ri';
import DOMPurify from 'dompurify';

// NavItem sub-component
function NavItem({ active, label, Icon, onClick }) {
  return (
    <li className={active ? 'active' : ''} onClick={onClick}>
      <div className="nav-item">
        <Icon className="nav-item-icon" />
        <span className="nav-item-label">{label}</span>
      </div>
    </li>
  );
}

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
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <h2 className="brand-title">StudentSphere</h2>
      </div>

      <div className="nav-menu">
        <ul>
          <NavItem 
            active={activeSection === 'home'} 
            label="Home" 
            Icon={FaHome} 
            onClick={() => handleSectionClick('home')} 
          />
          <NavItem 
            active={activeSection === 'info'} 
            label="Info Board" 
            Icon={BiInfoCircle} 
            onClick={() => handleSectionClick('info')} 
          />
          <NavItem 
            active={activeSection === 'funding'} 
            label="Funding" 
            Icon={RiMedalFill} 
            onClick={() => handleSectionClick('funding')} 
          />
          <NavItem 
            active={activeSection === 'communities'} 
            label="Communities" 
            Icon={FaUsers} 
            onClick={() => handleSectionClick('communities')} 
          />

          {userData && (
            <>
              <NavItem 
                active={activeSection === 'saved'} 
                label="Saved" 
                Icon={FaBookmark} 
                onClick={() => handleSectionClick('saved')} 
              />
              <NavItem 
                active={activeSection === 'connections'} 
                label="Connections" 
                Icon={FaPeopleCarry} 
                onClick={() => handleSectionClick('connections')} 
              />
              <NavItem 
                active={activeSection === 'profile'} 
                label="My Profile" 
                Icon={FaUserCircle} 
                onClick={() => handleSectionClick('profile')} 
              />
            </>
          )}
        </ul>
      </div>

      <div className="nav-right">
        <div className="nav-icons">
          {/* Search Bar */}
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button" aria-label="Search">
                <FaSearch size={14} />
              </button>
            </div>
          </form>
          {/* Dark Mode Toggle */}
          <button
            className="nav-icon dark-mode-toggle"
            onClick={toggleDarkMode}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>

          {/* Messages link */}
          <Link to="/messages">
            <FaEnvelope className="nav-icon" title="Messages" />
          </Link>

          {/* Notifications */}
          <div className="notification-container" ref={notificationRef}>
            <FaBell
              className="nav-icon"
              title="Notifications"
              onClick={toggleNotifications}
            />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}

            {isNotificationsOpen && (
              <div className="notifications-dropdown">
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
            >
              {userData.avatar_path ? (
                <img
                  src={`http://172.16.11.133${userData.avatar_path}`}
                  alt="User Avatar"
                  className="user-avatar"
                  onClick={() => setAccountMenuVisible(!accountMenuVisible)}
                />
              ) : (
                <FaUserCircle className="nav-icon" title="Account Settings" onClick={() => setAccountMenuVisible(!accountMenuVisible)} />
              )}
              {accountMenuVisible && (
                <div className="account-menu">
                  <div
                    className="account-menu-item"
                    onClick={() => alert('Account Settings')}
                    tabIndex={0}
                    role="button"
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
                    role="button"
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
