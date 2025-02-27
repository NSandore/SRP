// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Link,
  useNavigate,
  Navigate
} from 'react-router-dom';
import axios from 'axios';
import './App.css';
import {
  FaEnvelope,
  FaBell,
  FaUserCircle,
  FaBookmark,
  FaUniversity,
  FaBars,
  FaTimes,
  FaUsers,
  FaPeopleCarry,
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';
import { TbWriting } from 'react-icons/tb';
import { BiInfoCircle } from 'react-icons/bi';
import Connections from './components/Connections';
import { RiMedalFill } from 'react-icons/ri';
import SignUp from './components/SignUp';
import InterestSelection from './components/InterestSelection';
import Login from './components/Login';
import ForumView from './components/ForumView';   // Forum details + threads
import ThreadView from './components/ThreadView'; // Thread details
import SelfProfileView from './components/SelfProfileView'; // Profile view
import FollowsView from './components/FollowsView'; // Follows list view
import DOMPurify from 'dompurify'; 
import UserProfileView from './components/UserProfileView'; // New: Public user profile view
import UniversityProfile from './components/UniversityProfile';
import GroupProfile from './components/GroupProfile';
import Messages from './components/Messages'; // New Messages component
import useOnClickOutside from './hooks/useOnClickOutside';  // Hook to close popups when clicking outside
function ForumCard({
  forum,
  userData,
  openMenuId,
  setOpenMenuId,
  toggleMenu,
  isForumSaved,
  handleSaveForum,
  handleDeleteForum,
  handleUpvoteClick,
  handleDownvoteClick,
  startEditingForum
}) {
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
                                setOpenMenuId(null);
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
              setOpenMenuId(null);
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
}

function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);


  const [followingAmbassadors, setFollowingAmbassadors] = useState([]);

  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [showWelcome, setShowWelcome] = useState(false);

  const notificationRef = useRef(null); // Ref to handle click outside notifications
  useOnClickOutside(notificationRef, () => setIsNotificationsOpen(false));

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://34.31.85.242/api/check_session.php', {
          withCredentials: true
        });
        console.log("Session Data:", response.data); // Logs the $_SESSION data sent from PHP
        if (response.data?.loggedIn) {
          const user = response.data.user;
          user.role_id = Number(user.role_id);
          user.user_id = Number(user.user_id);
          setUserData(user);
          fetchNotifications(user.user_id);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };
  
    checkUserSession();
  }, []);  
  

  // Inside your App component
  useEffect(() => {
    console.log('User data changed:', userData);
    if (userData) {
      console.log('login_count:', userData.login_count);
      if (Number(userData.login_count) === 0) {
        console.log('login_count is 0, showing welcome overlay');
        setShowWelcome(true);
        // Auto-dismiss after 3 seconds (optional)
      } else {
        console.log('login_count is not 0, welcome overlay will not be shown');
      }
    }
  }, [userData]);

  const fetchNotifications = async (user_id) => {
    try {
      const response = await axios.get('http://34.31.85.242/api/fetch_notifications.php?user_id=${user_id}', {
        withCredentials: true
      });

      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // Toggle Notification Pop-up
  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
  };

  // Mark Notifications as Read
  const markAllAsRead = async () => {
    try {
      await axios.post('http://34.31.85.242/api/mark_notifications_read.php', { user_id: userData.user_id }, {
        withCredentials: true
      });

      // Refresh notifications
      fetchNotifications(userData.user_id);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  // Onboarding steps
  const handleNext = (formData) => {
    setUserData(formData);
    setStep(3);
  };

  const handleInterestComplete = (schools) => {
    setSelectedSchools(schools);
    setStep(0);
  };

  // Login
  const handleLogin = (user) => {
    user.role_id = Number(user.role_id);
    user.user_id = Number(user.user_id);
    setUserData(user);
    setStep(0);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await axios.post('http://34.31.85.242/api/logout.php', {}, { withCredentials: true });
      setUserData(null);
      setAccountMenuVisible(false);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const fetchAmbassadors = async () => {
    if (!userData) return;
    setLoadingAmbassadors(true);
    setErrorAmbassadors(null);
  
    try {
      const response = await axios.get(
        `http://34.31.85.242/api/fetch_all_community_ambassadors.php?user_id=${userData.user_id}`,
        { withCredentials: true }
      );
  
      if (response.data.success) {
        setAmbassadors(response.data.ambassadors);
      } else {
        setErrorAmbassadors(response.data.error || "Failed to load ambassadors.");
      }
    } catch (error) {
      console.error("Error fetching ambassadors:", error);
      setErrorAmbassadors("An error occurred while loading ambassadors.");
    } finally {
      setLoadingAmbassadors(false);
    }
  };

  useEffect(() => {
    if (userData) {
      axios.get(`http://34.31.85.242/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
        withCredentials: true
      })
      .then(response => {
        console.log("Connections Response:", response.data);
        if (response.data.success) {
          setFollowingAmbassadors(response.data.following || []);
        } else {
          console.error("Error fetching connections:", response.data.error || "No error message in response");
        }
      })
      .catch(error => {
        console.error("Network or server error fetching connections:", error);
      });
    }
  }, [userData]);  
  
  const handleFollowAmbassador = async (ambassadorId) => {
    if (!userData) {
      alert("You must be logged in to follow an ambassador.");
      return;
    }
  
    const isFollowing = followingAmbassadors.includes(ambassadorId);
    const endpoint = isFollowing ? "/api/unfollow_user.php" : "/api/follow_user.php";
  
    try {
      const response = await axios.post(endpoint, {
        follower_id: userData.user_id,
        followed_user_id: ambassadorId
      }, { withCredentials: true });
  
      if (response.data.success) {
        // Refetch the connections list to update following state
        axios.get(`http://34.31.85.242/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
          withCredentials: true
        }).then(res => {
          if (res.data.success) {
            setFollowingAmbassadors(res.data.following || []);
          }
        });
      } else {
        alert("Error: " + response.data.error);
      }
    } catch (error) {
      console.error("Error following/unfollowing ambassador:", error);
    }
  };  
  
  return (
    <Router>
      <div className="app-container">
        {/* Welcome Overlay */}
        {showWelcome && (
          <div className="welcome-overlay">
            <div className="welcome-message">
              <h1>Welcome to StudentSphere!</h1>
              <p>Start your journey by following ambassadors who can guide you.</p>
              <button
                className="get-started-button"
                onClick={() => {
                  setShowWelcome(false);  // Close welcome overlay
                  setShowAmbassadorOverlay(true); // Show ambassador overlay
                  fetchAmbassadors();
                }}
              >
                Get Started
              </button>
              <button onClick={() => setShowWelcome(false)}>Close</button>
            </div>
          </div>
        )}
        
        {/* Ambassador Overlay */}
        {showAmbassadorOverlay && (
          <div className="overlay">
            <div className="overlay-content">
              <h2>Ambassador List</h2>
              {loadingAmbassadors ? (
                <p>Loading ambassadors...</p>
              ) : errorAmbassadors ? (
                <p>{errorAmbassadors}</p>
              ) : (
                <ul className="ambassador-list">
                  {ambassadors.map((amb) => {
                    const isFollowing = followingAmbassadors.includes(amb.user_id);
                    return (
                      <li key={amb.id} className="ambassador-item">
                        <img
                          src={amb.avatar_path || "/uploads/avatars/default-avatar.png"}
                          alt={`${amb.first_name} ${amb.last_name}`}
                          className="ambassador-avatar"
                        />
                        <div className="ambassador-info">
                          <p className="ambassador-name">
                            <Link to={`/user/${amb.user_id}`}>
                              {amb.first_name} {amb.last_name}
                            </Link>
                          </p>
                          <p className="ambassador-headline">{amb.headline}</p>
                        </div>

                        {/* Dynamic Follow/Unfollow Button */}
                        <button
                          className={`follow-button ${isFollowing ? "unfollow" : "follow"}`}
                          onClick={() => handleFollowAmbassador(amb.user_id)}
                        >
                          {isFollowing ? "Unfollow" : "Follow"}
                        </button>

                        <button className="message-button" onClick={() => alert(`Message ${amb.first_name} ${amb.last_name}`)}>
                          Message
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button onClick={() => setShowAmbassadorOverlay(false)}>Close</button>
            </div>
          </div>
        )}

        {step === 1 && <SignUp onNext={handleNext} />}
        {step === 2 && (
          <Login
            onLogin={handleLogin}
            onGoToSignUp={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <InterestSelection onComplete={handleInterestComplete} />
        )}

        {step === 0 && (
          <>
            <NavBar
              activeFeed={activeFeed}
              setStep={setStep}
              setActiveFeed={setActiveFeed}  // This prop is passed down
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              userData={userData}
              accountMenuVisible={accountMenuVisible}
              setAccountMenuVisible={setAccountMenuVisible}
              handleLogout={handleLogout}
              toggleNotifications={toggleNotifications}
              notifications={notifications}
              isNotificationsOpen={isNotificationsOpen}
              notificationRef={notificationRef}
              markAllAsRead={markAllAsRead}
            />
            <div className="main-content">
              {/*<LeftSidebar
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                setActiveFeed={setActiveFeed}
                userData={userData}
              /> */}

              <Routes>
                <Route
                  path="/home"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="home"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/info"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="info"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/saved"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="saved"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/connections"
                  element={userData ? <Connections userData={userData} /> : <Navigate to="/login" />}
                />
                <Route
                  path="/scholarships"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="scholarships"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/communities"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="communities"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/profile"
                  element={userData ? <SelfProfileView userData={userData} /> : <Navigate to="/login" />}
                />
                {/* Forum + Thread routes */}
                <Route
                  path="/info/forum/:forum_id"
                  element={<ForumView userData={userData} />}
                />
                <Route
                  path="/info/forum/:forum_id/thread/:thread_id"
                  element={<ThreadView userData={userData} />}
                />
                <Route path="/user/:user_id" element={<UserProfileView userData={userData} />} />
                {/* New routes for universities and groups */}
                <Route path="/university/:id" element={<UniversityProfile userData={userData} />} />
                <Route path="/group/:id" element={<GroupProfile userData={userData} />} />
                <Route path="/messages" element={<Messages userData={userData} />} />
              </Routes>

              {/* Conditionally render RightSidebar if user is on home or info */}
              {(activeSection === 'home' || activeSection === 'info') && <RightSidebar />}
            </div>
          </>
        )}
      </div>
    </Router>
  );
}

/* =================== NavBar Component =================== */
function NavBar({
  setStep,
  activeFeed,
  setActiveFeed,
  activeSection,
  userData,
  accountMenuVisible,
  setActiveSection, // Now available!
  setAccountMenuVisible,
  handleLogout,
  toggleNotifications, 
  notifications, 
  isNotificationsOpen, 
  notificationRef,
  markAllAsRead,
}) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => parseInt(n.is_read, 10) === 0).length;

  const handleSectionClick = (section) => {
    setActiveSection(section);
    setActiveFeed('yourFeed');
    navigate(`/${section}`);
  };  

  return (
    <nav className="nav-bar">
      {/* Left side: brand */}
      <div className="nav-left">
        <h2 className="brand-title">StudentSphere</h2>
      </div>

      {/* Center: Horizontal Menu */}
      <div className="nav-menu">
        <ul>
          <li 
            className={activeSection === 'home' ? 'active' : ''}
            onClick={() => handleSectionClick('home')}
          >
            Home
          </li>
          <li 
            className={activeSection === 'info' ? 'active' : ''}
            onClick={() => handleSectionClick('info')}
          >
            Info Board
          </li>
          <li 
            className={activeSection === 'scholarships' ? 'active' : ''}
            onClick={() => handleSectionClick('scholarships')}
          >
            Scholarships
          </li>
          <li 
            className={activeSection === 'communities' ? 'active' : ''}
            onClick={() => handleSectionClick('communities')}
          >
            Communities
          </li>

          {/* Only show saved/connections/profile if logged in */}
          {userData && (
            <>
              <li 
                className={activeSection === 'saved' ? 'active' : ''}
                onClick={() => handleSectionClick('saved')}
              >
                Saved
              </li>
              <li 
                className={activeSection === 'connections' ? 'active' : ''}
                onClick={() => handleSectionClick('connections')}
              >
                Connections
              </li>
              <li 
                className={activeSection === 'profile' ? 'active' : ''}
                onClick={() => handleSectionClick('profile')}
              >
                My Profile
              </li>
            </>
          )}
        </ul>
      </div>

      {/*<div className="nav-center">
        {activeSection === 'home' && (
          <div className="feed-options">
            <button
              className={`feed-option-button ${activeFeed === 'yourFeed' ? 'active' : ''}`}
              onClick={() => setActiveFeed('yourFeed')}
            >
              Your Feed
            </button>
            <button
              className={`feed-option-button ${activeFeed === 'suggested' ? 'active' : ''}`}
              onClick={() => setActiveFeed('suggested')}
            >
              Explore
            </button>
          </div>
        )}
      </div>*/}

      <div className="nav-right">
        <div className="nav-icons">
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
              onClick={() => setAccountMenuVisible(!accountMenuVisible)}
              tabIndex={0}
              role="button"
              onKeyPress={(e) => {
                if (e.key === 'Enter') setAccountMenuVisible(!accountMenuVisible);
              }}
              aria-haspopup="true"
              aria-expanded={accountMenuVisible}
            >
              {userData.avatar_path ? (
                <img
                  src={`http://34.31.85.242${userData.avatar_path}`} // Ensure the base URL is correct
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

/* =================== LeftSidebar Component =================== */
function LeftSidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeSection,
  setActiveSection,
  setActiveFeed,
  userData
}) {
  const navigate = useNavigate();

  const handleSectionClick = (section) => {
    setActiveSection(section);
    setActiveFeed('yourFeed');
    navigate(`/${section}`);
  };

  const sidebarItems = [
    { name: 'home', icon: <TbWriting />, text: 'Home' },
    { name: 'info', icon: <BiInfoCircle />, text: 'Information Board' },
    { name: 'scholarships', icon: <RiMedalFill />, text: 'Scholarships' },
    { name: 'communities', icon: <FaUniversity />, text: 'Communities' }
  ];

  const authSidebarItems = [
    { name: 'saved', icon: <FaBookmark />, text: 'Saved' },
    { name: 'connections', icon: <FaUsers />, text: 'Connections' },
    { name: 'profile', icon: <FaUserCircle />, text: 'My Profile' }
  ];

  return (
    <aside className={`left-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <ul className="sidebar-list">
        <li className="sidebar-toggle-container">
          <button
            className="sidebar-toggle-button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isSidebarCollapsed}
          >
            {isSidebarCollapsed ? <FaBars /> : <FaTimes />}
          </button>
        </li>

        {sidebarItems.map((item) => (
          <li
            key={item.name}
            className={`sidebar-item ${activeSection === item.name ? 'active' : ''}`}
            onClick={() => handleSectionClick(item.name)}
            tabIndex={0}
            role="button"
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSectionClick(item.name);
            }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-text">{item.text}</span>
          </li>
        ))}

        {userData &&
          authSidebarItems.map((item) => (
            <li
              key={item.name}
              className={`sidebar-item ${activeSection === item.name ? 'active' : ''}`}
              onClick={() => handleSectionClick(item.name)}
              tabIndex={0}
              role="button"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSectionClick(item.name);
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.text}</span>
            </li>
          ))}
      </ul>
    </aside>
  );
}

/* =================== RightSidebar Component =================== */
function RightSidebar() {
  return (
    <aside className="right-sidebar">
      <h3>Trending Topics</h3>
      <ul>
        <li>#FinancialAid</li>
        <li>#Admissions</li>
        <li>#StudentResources</li>
      </ul>
    </aside>
  );
}

/* =================== Feed Component =================== */
function Feed({ activeFeed, setActiveFeed, activeSection, userData }) {
  const [sortBy, setSortBy] = useState("default"); // options: "default", "popularity", "mostUpvoted"
  const [communityFilter, setCommunityFilter] = useState('All'); // Options: "All", "Followed", "Unfollowed"
  const [selectedCommunityTab, setSelectedCommunityTab] = useState("university");

  const [followedCommunities, setFollowedCommunities] = useState([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);

  const [allCommunities, setAllCommunities] = useState([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [forums, setForums] = useState([]);
  const [isLoadingForums, setIsLoadingForums] = useState(false);

  const [showCreateForumModal, setShowCreateForumModal] = useState(false);
  const [newForumName, setNewForumName] = useState('');
  const [newForumDescription, setNewForumDescription] = useState('');
  const [isCreatingForum, setIsCreatingForum] = useState(false);

  const [editForumId, setEditForumId] = useState(null);
  const [editForumName, setEditForumName] = useState('');
  const [editForumDescription, setEditForumDescription] = useState('');
  const [isEditingForum, setIsEditingForum] = useState(false);

  const [notification, setNotification] = useState(null);

  // For 3-dot menu
  const [openMenuId, setOpenMenuId] = useState(null);

  // ============== S A V E D ==============
  // We’ll store arrays for savedForums, savedThreads, savedPosts
  const [savedForums, setSavedForums] = useState([]);
  const [savedThreads, setSavedThreads] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  // Track which saved tab is active
  const [savedTab, setSavedTab] = useState('forums'); // 'forums' | 'threads' | 'posts'

  const [feedPosts, setFeedPosts] = useState([]);
  const [feedThreads, setFeedThreads] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Handler for voting on threads:
  const handleThreadVoteClick = async (threadId, voteType) => {
    if (!userData) {
      alert("You must be logged in to vote.");
      return;
    }
    try {
      const response = await axios.post(
        "/api/vote_thread.php",
        {
          thread_id: threadId,
          user_id: userData.user_id,
          vote_type: voteType,
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        // Refresh the feed threads after voting
        fetchFeedThreads();
      } else {
        alert(response.data.error || "An error occurred.");
      }
    } catch (error) {
      console.error("Error voting on thread:", error);
      alert("An error occurred while voting on thread.");
    }
  };

  const handleThreadUpvoteClick = (threadId) =>
    handleThreadVoteClick(threadId, "up");
  const handleThreadDownvoteClick = (threadId) =>
    handleThreadVoteClick(threadId, "down");

  const fetchFeedThreads = () => {
    if (activeSection === "home" && activeFeed === "yourFeed" && userData) {
      setIsLoadingFeed(true);
      axios
        .get(`/api/fetch_feed.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        })
        .then((response) => {
          if (response.data.success) {
            setFeedThreads(response.data.threads);
          } else {
            console.error("Error fetching feed:", response.data.error);
          }
        })
        .catch((error) => {
          console.error("Error fetching feed:", error);
        })
        .finally(() => {
          setIsLoadingFeed(false);
        });
    }
  };
  
  // Helper to fetch saved items
  const fetchSavedForums = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(`/api/fetch_saved_forums.php?user_id=${userData.user_id}`, {
        withCredentials: true
      });
      if (resp.data.success) {
        setSavedForums(resp.data.saved_forums || []);
      }
    } catch (error) {
      console.error('Error fetching saved forums:', error);
    }
  };

  const fetchSavedThreads = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(`/api/fetch_saved_threads.php?user_id=${userData.user_id}`, {
        withCredentials: true
      });
      if (resp.data.success) {
        setSavedThreads(resp.data.saved_threads || []);
      }
    } catch (error) {
      console.error('Error fetching saved threads:', error);
    }
  };

  const fetchSavedPosts = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(`/api/fetch_saved_posts.php?user_id=${userData.user_id}`, {
        withCredentials: true
      });
      if (resp.data.success) {
        setSavedPosts(resp.data.saved_posts || []);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    }
  };

  // Toggle Menu
  const toggleMenu = (forumId) => {
    setOpenMenuId(openMenuId === forumId ? null : forumId);
  };

  // Save Forum or Unsave Forum
  // We'll add logic so that if the forum is already saved, we call unsave_forum.
  const handleSaveForum = async (forumId, isAlreadySaved) => {
    if (!userData) return;
    try {
      let url = isAlreadySaved ? '/api/unsave_forum.php' : '/api/save_forum.php';
      const resp = await axios.post(
        url,
        { user_id: userData.user_id, forum_id: forumId },
        { withCredentials: true }
      );
      if (resp.data.success) {
        // if we’re in info or communities, re-fetch savedForums
        await fetchSavedForums();
        alert(isAlreadySaved ? 'Forum unsaved!' : 'Forum saved!');
      } else {
        alert('Error: ' + (resp.data.error || 'Unknown error.'));
      }
    } catch (error) {
      console.error('Error saving/unsaving forum:', error);
      alert('An error occurred while saving/unsaving the forum.');
    }
    setOpenMenuId(null);
  };

  // -------------- For Communities --------------
  const fetchFollowedCommunities = async () => {
    if (!userData) return;
    setIsLoadingFollowed(true);
    try {
      const response = await axios.get(
        `/api/followed_communities.php?user_id=${userData.user_id}`
      );
      setFollowedCommunities(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching followed communities:', error);
      setFollowedCommunities([]);
    } finally {
      setIsLoadingFollowed(false);
    }
  };

  const fetchAllCommunitiesData = async (page = 1, term = '') => {
    if (!userData) return;
    setIsLoadingAll(true);
    try {
      // Select the correct endpoint based on the selected community tab
      const endpoint =
        selectedCommunityTab === "university"
          ? "/api/fetch_all_university_data.php"
          : "/api/fetch_all_group_data.php";
      const response = await axios.get(
        `${endpoint}?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`
      );
      // Ensure that communities is an array
      const communities = response.data.communities;
      setAllCommunities(Array.isArray(communities) ? communities : []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching all communities:', error);
      setAllCommunities([]);
      setTotalPages(1);
    } finally {
      setIsLoadingAll(false);
    }
  };
  
  //
  // 3) Fetch Forums (e.g., community_id=3 for "info")
  //
  const fetchForums = async (communityId) => {
    if (!userData) {
      setIsLoadingForums(false);
      return;
    }
    setIsLoadingForums(true);
    try {
      const resp = await axios.get(`/api/fetch_forums.php?community_id=${communityId}&user_id=${userData.user_id}`);
      console.log("Fetched forums response:", resp.data);
      const forumsData = resp.data.forums || resp.data;
      if (Array.isArray(forumsData)) {
        setForums(forumsData);
      } else {
        console.warn("Expected an array but got:", forumsData);
        setForums([]);
      }
    } catch (error) {
      console.error("Error fetching forums:", error);
      setForums([]);
    } finally {
      setIsLoadingForums(false);
    }
  };  

  // A helper function to sort items
  const sortItems = (items, criteria) => {
    const sorted = [...items]; // Create a shallow copy to avoid mutating the original array
  
    if (criteria === "popularity") {
      // Sort by total votes (upvotes + downvotes), descending
      sorted.sort((a, b) => 
        (parseInt(b.upvotes, 10) + parseInt(b.downvotes, 10)) -
        (parseInt(a.upvotes, 10) + parseInt(a.downvotes, 10))
      );
    } else if (criteria === "mostUpvoted") {
      // Sort by upvotes only, descending
      sorted.sort((a, b) => parseInt(b.upvotes, 10) - parseInt(a.upvotes, 10));
    } else if (criteria === "mostRecent") {
      // Sort by newest created_at timestamp, descending
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  
    return sorted;
  };
  
  // Apply sorting if sortBy is set, otherwise use default order
  const sortedForums = sortBy === "default" ? forums : sortItems(forums, sortBy);

  // Handles voting actions (upvote/downvote)
  const handleVoteClick = async (forumId, voteType) => {
    if (!userData) {
      alert("You must be logged in to vote.");
      return;
    }

    try {
      const response = await axios.post(
        "/api/vote_forum.php",
        {
          forum_id: forumId,
          user_id: userData.user_id,
          vote_type: voteType
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        // Refresh forums after voting
        fetchForums(3);
      } else {
        alert(response.data.error || "An error occurred.");
      }
    } catch (error) {
      console.error("Error voting:", error);
      alert("An error occurred while voting.");
    }
  };

  // Click handlers for upvote and downvote
  const handleUpvoteClick = (forumId) => handleVoteClick(forumId, "up");
  const handleDownvoteClick = (forumId) => handleVoteClick(forumId, "down");

  
  useEffect(() => {
    if (activeSection === 'communities' && userData) {
      fetchFollowedCommunities();
      fetchAllCommunitiesData(1, '');
      setCurrentPage(1);
      setSearchTerm('');
    }
    if (activeSection === 'info') {
      // For demonstration: fetch forums for community_id=3
      fetchForums(3);
      // Also fetch saved forums so we know which ones are saved
      fetchSavedForums();
    }
    if (activeSection === 'saved' && userData) {
      // Load saved forums, threads, posts
      fetchSavedForums();
      fetchSavedThreads();
      fetchSavedPosts();
      setSavedTab('forums');
    }
  }, [activeSection, userData, selectedCommunityTab]);  

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunitiesData(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, activeSection, selectedCommunityTab]);  

  // Pagination
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchAllCommunitiesData(newPage, searchTerm);
    }
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchAllCommunitiesData(newPage, searchTerm);
    }
  };  

  // Follow / Unfollow
  const handleFollowToggle = async (communityId, isFollowed) => {
    if (!userData) return;
    try {
      if (isFollowed) {
        await axios.post('/api/unfollow_community.php', {
          user_id: userData.user_id,
          community_id: communityId
        });
      } else {
        await axios.post('/api/follow_community.php', {
          user_id: userData.user_id,
          community_id: communityId
        });
      }
      fetchFollowedCommunities();
      fetchAllCommunitiesData(currentPage, searchTerm);
    } catch (error) {
      console.error('Error toggling follow status:', error);
      alert('An error occurred while updating follow status.');
    }
  };

  // Create a set for quick lookup
  //const followedIds = new Set(followedCommunities.map((c) => c.community_id));

  //
  // 5) Create Forum
  //
  const handleCreateForumSubmit = async (e) => {
    e.preventDefault();
    setIsCreatingForum(true);
    try {
      const resp = await axios.post('/api/create_forum.php', {
        community_id: 3, // or dynamic if needed
        name: newForumName,
        description: newForumDescription
      });
      if (resp.data.success) {
        setNewForumName('');
        setNewForumDescription('');
        setShowCreateForumModal(false);
        // Refresh forums
        fetchForums(3);
        setNotification({ type: 'success', message: 'Forum created successfully!' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Error creating forum.' });
      }
    } catch (error) {
      console.error('Error creating forum:', error);
      setNotification({ type: 'error', message: 'An error occurred while creating the forum.' });
    } finally {
      setIsCreatingForum(false);
    }
  };

  //
  // 6) Edit Forum (start & submit)
  //
  const startEditingForum = (forum) => {
    setEditForumId(forum.forum_id);
    setEditForumName(forum.name);
    setEditForumDescription(forum.description || '');
    setIsEditingForum(true);
  };

  const cancelEditingForum = () => {
    setEditForumId(null);
    setEditForumName('');
    setEditForumDescription('');
    setIsEditingForum(false);
  };

  const handleEditForumSubmit = async (e) => {
    e.preventDefault();
    try {
      const resp = await axios.post('/api/edit_forum.php', {
        forum_id: editForumId,
        name: editForumName,
        description: editForumDescription
      });
      if (resp.data.success) {
        fetchForums(3);
        setNotification({ type: 'success', message: 'Forum updated successfully.' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Error editing forum.' });
      }
    } catch (error) {
      console.error('Error editing forum:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while editing the forum.'
      });
    } finally {
      cancelEditingForum();
    }
  };

  //
  // 7) Delete Forum
  //
  const handleDeleteForum = async (forum_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a forum.' });
      return;
    }
    try {
      const resp = await axios.post('/api/delete_forum.php', { forum_id });
      if (resp.data.success) {
        // Refresh
        fetchForums(3);
        setNotification({ type: 'success', message: 'Forum deleted successfully.' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Error deleting forum.' });
      }
    } catch (error) {
      console.error('Error deleting forum:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while deleting the forum.'
      });
    }
  };

  //
  // If the user is NOT in "info" or "communities," we might show mock content:
  //
  let mockPosts = [];
  useEffect(() => {
    if (activeSection === 'home' && activeFeed === 'yourFeed' && userData) {
      setIsLoadingFeed(true);
      axios
        .get(`/api/fetch_feed.php?user_id=${userData.user_id}`, { withCredentials: true })
        .then(response => {
          if (response.data.success) {
            setFeedThreads(response.data.threads); // Use threads here
          } else {
            console.error("Error fetching feed:", response.data.error);
          }
        })
        .catch(error => {
          console.error("Error fetching feed:", error);
        })
        .finally(() => {
          setIsLoadingFeed(false);
        });
    }
  }, [activeSection, activeFeed, userData]);  
  
  // In your return statement inside Feed, add a conditional for the "Your Feed" view:
  if (activeSection === 'home') {
    return (
      <main className="feed">
        {/* Show the feed-option buttons if we are on home */}
        <div className="feed-options" style={{ marginBottom: '1rem' }}>
          <button
            className={`feed-option-button ${activeFeed === 'yourFeed' ? 'active' : ''}`}
            onClick={() => setActiveFeed('yourFeed')}
          >
            Your Feed
          </button>
          <button
            className={`feed-option-button ${activeFeed === 'suggested' ? 'active' : ''}`}
            onClick={() => setActiveFeed('suggested')}
          >
            Explore
          </button>
        </div>
        <h2>
          {activeSection === 'home'
            ? activeFeed === 'yourFeed'
              ? 'Your Feed'
              : 'Explore'
            : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
        </h2>
        {isLoadingFeed ? (
          <p>Loading feed...</p>
        ) : feedThreads.length === 0 ? (
          <p>No threads in your feed.</p>
        ) : (
          feedThreads.map((thread) => (
            <div
              key={thread.thread_id}
              className="feed-thread-card"
              style={{
                marginBottom: "1rem",
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            >
              <div className="thread-header">
                {/* Thread Link */}
                <Link
                  to={`/info/forum/${thread.forum_id}/thread/${thread.thread_id}`}
                  className="thread-link"
                >
                  {/* New line for Community Name */}
                  <small className="thread-community">
                    {" "}
                    <Link
                      to={`/${thread.community_type}/${thread.community_id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {thread.community_name}
                    </Link>
                  </small>
                  <h3 className="thread-title">{thread.title}</h3>
                  <small>
                    Posted by{" "}
                    <Link to={`/user/${thread.user_id}`} style={{ textDecoration: "none" }}>
                      {thread.first_name} {thread.last_name ? thread.last_name.charAt(0) + "." : ""}
                    </Link>{" "}
                    on {new Date(thread.created_at).toLocaleString()}
                  </small>
                </Link>
              </div>
              {/* Vote Row */}
              <div className="vote-row">
                <button
                  type="button"
                  className="vote-button upvote-button"
                  title="Upvote"
                  onClick={() => handleThreadUpvoteClick(thread.thread_id)}
                >
                  {thread.user_vote === "up" ? (
                    <FaArrowAltCircleUp style={{ color: "green" }} />
                  ) : (
                    <FaRegArrowAltCircleUp style={{ color: "gray" }} />
                  )}
                </button>
                <span className="vote-count">{thread.upvotes}</span>
                <button
                  type="button"
                  className="vote-button downvote-button"
                  title="Downvote"
                  onClick={() => handleThreadDownvoteClick(thread.thread_id)}
                >
                  {thread.user_vote === "down" ? (
                    <FaArrowAltCircleDown style={{ color: "red" }} />
                  ) : (
                    <FaRegArrowAltCircleDown style={{ color: "gray" }} />
                  )}
                </button>
                <span className="vote-count">{thread.downvotes}</span>
              </div>
            </div>
          ))
        )}
      </main>
    );
  }    

  // Create a set for quick lookup of followed community IDs.
  const followedIds = new Set(followedCommunities.map((c) => c.community_id));

  // Filter communities by selected type and then by the Followed/Unfollowed/All filter.
  const filteredCommunities = allCommunities.filter((community) => {
    // First, ensure the community is of the selected type.
    if (community.community_type !== selectedCommunityTab) return false;

    // Then apply the followed filter.
    if (communityFilter === 'Followed') {
      return followedIds.has(community.community_id);
    } else if (communityFilter === 'Unfollowed') {
      return !followedIds.has(community.community_id);
    }
    return true; // For "All", include every community of the selected type.
  });

  return (
    <main className="feed">
      <h2>
        {activeSection === 'home'
          ? activeFeed === 'yourFeed'
            ? 'Your Feed'
            : 'Explore'
          : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
      </h2>

      {/* 1) INFO SECTION */}
      {activeSection === 'info' && (
        <>
          {/* Admin create forum */}
          {userData?.role_id === 7 && (
            <button className="create-button" onClick={() => setShowCreateForumModal(true)}>
              Create Forum
            </button>
          )}

          {/* CREATE MODAL */}
          {showCreateForumModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Create a New Forum</h3>
                <form onSubmit={handleCreateForumSubmit}>
                  <div className="form-group">
                    <label htmlFor="forum-name">Forum Name:</label>
                    <input
                      type="text"
                      id="forum-name"
                      value={newForumName}
                      onChange={(e) => setNewForumName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="forum-description">Description:</label>
                    <textarea
                      id="forum-description"
                      value={newForumDescription}
                      onChange={(e) => setNewForumDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" disabled={isCreatingForum}>
                      {isCreatingForum ? 'Creating...' : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowCreateForumModal(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT MODAL */}
          {isEditingForum && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Edit Forum</h3>
                <form onSubmit={handleEditForumSubmit}>
                  <div className="form-group">
                    <label htmlFor="edit-forum-name">Forum Name:</label>
                    <input
                      type="text"
                      id="edit-forum-name"
                      value={editForumName}
                      onChange={(e) => setEditForumName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-forum-description">Description:</label>
                    <textarea
                      id="edit-forum-description"
                      value={editForumDescription}
                      onChange={(e) => setEditForumDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setIsEditingForum(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Sorting Dropdown */}
          <div className="sort-container" style={{ marginBottom: '1rem' }}>
            <label htmlFor="sort-by">Sort by: </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="popularity">Popularity</option>
              <option value="mostUpvoted">Most Upvoted</option>
              <option value="mostRecent">Most Recent</option> {/* New option */}
            </select>
          </div>

          <h2 className="forum-title">Forums</h2>
          {isLoadingForums ? (
            <p>Loading forums...</p>
          ) : forums.length === 0 ? (
            <p>No forums available.</p>
          ) : (
            <div className="forum-list">
              {sortedForums.map((forum) => {
                const canEditDeleteForum = userData?.role_id === 7;
                const isSaved = savedForums.some((sf) => sf.forum_id === forum.forum_id);
                const hasUpvoted = forum.user_vote === 'up';
                const hasDownvoted = forum.user_vote === 'down';

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
                          width: '120px'
                        }}
                      >
                        {userData && userData.is_ambassador === "1" && (
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
                              console.log("Add to University button clicked");
                              // Assume the forum object has a community_id field which is the community to pin to.
                              axios.post('/api/pin_to_community.php', {
                                community_id: forum.community_id, // The community that the ambassador represents
                                item_id: forum.forum_id,           // The forum to be pinned
                                item_type: 'forum'
                              }, { withCredentials: true })
                              .then(response => {
                                if (response.data.success) {
                                  alert('Forum pinned to community successfully!');
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
                            Add to University Feed
                          </button>
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
                              console.log(
                                'Save/Unsave button clicked for forum_id: ${forum.forum_id}, currently saved: ${forum.saved}'
                              );
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
                            console.log(`Report button clicked for forum_id: ${forum.forum_id}`);
                            alert('Report forum with ID ${forum.forum_id}');
                            setOpenMenuId(null);
                          }}
                        >
                          Report
                        </button>
                      </div>
                    )}


                    {/* Forum Link */}
                    <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 className="forum-title">{forum.name}</h3>
                      <p className="forum-thread-count">{forum.thread_count || 0} Threads</p>
                      <p className="forum-description">{forum.description}</p>
                    </Link>

                    {/* Upvote/Downvote Buttons */}
                    <div className="vote-row">
                      <button
                        type="button"
                        className={`vote-button upvote-button ${forum.user_vote === 'up' ? 'active' : ''}`}
                        onClick={() => handleUpvoteClick(forum.forum_id)}
                        title="Upvote"
                        aria-label="Upvote"
                      >
                        {forum.user_vote === 'up' ? <FaArrowAltCircleUp /> : <FaRegArrowAltCircleUp />}
                      </button>
                      <span className="vote-count">{forum.upvotes}</span>
                      <button
                        type="button"
                        className={`vote-button downvote-button ${forum.user_vote === 'down' ? 'active' : ''}`}
                        onClick={() => handleDownvoteClick(forum.forum_id)}
                        title="Downvote"
                        aria-label="Downvote"
                      >
                        {forum.user_vote === 'down' ? <FaArrowAltCircleDown /> : <FaRegArrowAltCircleDown />}
                      </button>
                      <span className="vote-count">{forum.downvotes}</span>
                    </div>
                    
                    {/* Admin Edit/Delete Buttons */}
                    {canEditDeleteForum && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button
                          style={{
                            backgroundColor: '#ffa500',
                            color: '#fff',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => startEditingForum(forum)}
                        >
                          Edit
                        </button>
                        <button
                          style={{
                            backgroundColor: '#ff6961',
                            color: '#fff',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleDeleteForum(forum.forum_id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 2) COMMUNITIES SECTION */}
      {activeSection === 'communities' && (
        <>
          <div className="communities-section">
            {/* Community Type Tabs */}
            <div className="community-tab">
              <button
                onClick={() => setSelectedCommunityTab("university")}
                className={selectedCommunityTab === "university" ? "active" : ""}
              >
                Universities
              </button>
              <button
                onClick={() => setSelectedCommunityTab("group")}
                className={selectedCommunityTab === "group" ? "active" : ""}
              >
                Groups
              </button>
            </div>

            {/* Filter Controls for Followed/Unfollowed/All */}
            <div className="filter-buttons">
              <button
                onClick={() => setCommunityFilter('All')}
                className={communityFilter === 'All' ? 'active' : ''}
              >
                All
              </button>
              <button
                onClick={() => setCommunityFilter('Followed')}
                className={communityFilter === 'Followed' ? 'active' : ''}
              >
                Followed
              </button>
              <button
                onClick={() => setCommunityFilter('Unfollowed')}
                className={communityFilter === 'Unfollowed' ? 'active' : ''}
              >
                Unfollowed
              </button>
            </div>

            {/* Search Bar */}
            <div className="search-bar-container">
              <input
                id="community-search"
                type="text"
                placeholder="Search communities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="community-search-bar"
              />
            </div>

            {/* Display Filtered Communities */}
            <div className="communities-section">
              {isLoadingAll ? (
                <p>Loading communities...</p>
              ) : filteredCommunities.length > 0 ? (
                <div className="community-grid">
                  {filteredCommunities.map((community) => (
                    <div
                      key={community.community_id}
                      className="community-card"
                      // If in "All" mode and the community is followed, outline in green.
                      style={
                        communityFilter === 'All' && followedIds.has(community.community_id)
                          ? { border: '2px solid green' }
                          : {}
                      }
                    >
                      <img
                        src={community.logo_path || '/uploads/logos/default-logo.png'}
                        alt={`${community.name} Logo`}
                        className="community-logo"
                        loading="lazy"
                      />
                      <Link
                        to={`/${community.community_type}/${community.community_id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <h4 className="community-name">{community.name}</h4>
                      </Link>
                      <p className="community-location">{community.location}</p>
                      {community.tagline && <p className="community-tagline">{community.tagline}</p>}
                      <p className="followers-count">{community.followers_count} Followers</p>
                      <button
                        className={`follow-button ${followedIds.has(community.community_id) ? 'unfollow' : 'follow'}`}
                        onClick={() =>
                          handleFollowToggle(community.community_id, followedIds.has(community.community_id))
                        }
                      >
                        {followedIds.has(community.community_id) ? 'Unfollow' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No {selectedCommunityTab === "university" ? "universities" : "groups"} found.</p>
              )}
              {/* Pagination Controls */}
              <div className="pagination-controls">
                <button onClick={handlePrevPage} disabled={currentPage === 1} className="pagination-button">
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages} className="pagination-button">
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3) SAVED SECTION */}
      {activeSection === 'saved' && userData && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <button
              style={{ marginRight: '0.5rem' }}
              onClick={() => setSavedTab('forums')}
            >
              Saved Forums
            </button>
            <button
              style={{ marginRight: '0.5rem' }}
              onClick={() => setSavedTab('threads')}
            >
              Saved Threads
            </button>
            <button
              onClick={() => setSavedTab('posts')}
            >
              Saved Posts
            </button>
          </div>

          {/* Show the relevant list based on savedTab */}
          {savedTab === 'forums' && (
            <>
              <h3>Saved Forums</h3>
              {savedForums.length === 0 ? (
                <p>You have no saved forums.</p>
              ) : (
                savedForums.map((f) => (
                  <div key={f.forum_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                    <Link
                      to={`/info/forum/${f.forum_id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <h4>{f.name}</h4>
                      <p>{f.description}</p>
                    </Link>
                    <button
                      style={{
                        backgroundColor: '#ccc',
                        color: '#333',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleSaveForum(f.forum_id, true)} // true = unsave
                    >
                      Unsave
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {savedTab === 'threads' && (
            <>
              <h3>Saved Threads</h3>
              {savedThreads.length === 0 ? (
                <p>You have no saved threads.</p>
              ) : (
                savedThreads.map((t) => (
                  <div key={t.thread_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                    {/* Link to thread details if you have a route like /info/forum/x/thread/y */}
                    <Link
                      to={`/info/forum/0/thread/${t.thread_id}`} 
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <h4>{t.title}</h4>
                    </Link>
                    <button
                      style={{
                        backgroundColor: '#ccc',
                        color: '#333',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        // call /api/unsave_thread.php
                        // or handle logic to unsave
                        // for demonstration:
                        alert(`Unsave thread: ${t.thread_id}`);
                      }}
                    >
                      Unsave
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {savedTab === 'posts' && (
            <>
              <h3>Saved Posts</h3>
              {savedPosts.length === 0 ? (
                <p>You have no saved posts.</p>
              ) : (
                savedPosts.map((p) => (
                  <div key={p.post_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                    <h4>Post #{p.post_id}</h4>
                    {/* 
                      Render the HTML content properly instead of just {p.content}.
                      We can sanitize it with DOMPurify if needed:
                    */}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify ? DOMPurify.sanitize(p.content) : p.content
                      }}
                    />
                    <br></br>
                    <button
                      style={{
                        backgroundColor: '#ccc',
                        color: '#333',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        // call /api/unsave_post.php
                        // for demonstration:
                        alert(`Unsave post: ${p.post_id}`);
                      }}
                    >
                      Unsave
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}

      {/* Render "mock posts" for any other sections */}
      {['home', 'connections', 'scholarships'].includes(activeSection) && (
        (activeSection !== 'info' && activeSection !== 'communities' && activeSection !== 'saved') &&
          mockPosts.map((post, i) => (
            <div key={i} className="post-card">
              <h3>{post.title}</h3>
              <small>Posted by {post.author}</small>
              <p>{post.content}</p>
            </div>
          ))
      )}

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button
            className="notification-close"
            onClick={() => setNotification(null)}
          >
            X
          </button>
        </div>
      )}
    </main>
  );
}

export default App;