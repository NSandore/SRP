// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import {
  Route,
  Routes,
  Link,
  useNavigate,
  useLocation,
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
  FaHome,
  FaPeopleCarry,
  FaEllipsisV,
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';
import { TbWriting } from 'react-icons/tb';
import { BiInfoCircle } from 'react-icons/bi';
import UserConnections from './components/UserConnections';
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
import RightSidebar from './components/RightSidebar';
import AppShell from './layout/AppShell';
import ForumCard from './components/ForumCard';
import Feed from './components/Feed';
import ContactUsButton from './components/ContactUsButton';
import SearchResults from './components/SearchResults';
import CommunityRequests from './components/CommunityRequests';
import AuthOverlay from './components/AuthOverlay';

const PROTECTED_ROUTES = ['/profile', '/saved', '/connections'];

function App() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('explore');
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);
  const [requireAuthOverlay, setRequireAuthOverlay] = useState(false);
  const [followingAmbassadors, setFollowingAmbassadors] = useState([]);
  const [lastAccessiblePath, setLastAccessiblePath] = useState('/home');
  const [pendingProtectedReturnPath, setPendingProtectedReturnPath] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [showWelcome, setShowWelcome] = useState(false);

  const getInitials = (firstName = '', lastName = '') => {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || 'A';
  };

  const notificationRef = useRef(null); // Ref to handle click outside notifications
  useOnClickOutside(notificationRef, () => setIsNotificationsOpen(false));
  const navigate = useNavigate();
  const location = useLocation();
  const authRoutes = ['/login', '/signup'];
  const isAuthPage = authRoutes.includes(location.pathname);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('/api/check_session.php', {
          withCredentials: true
        });

        console.log("Session Data:", response.data);

        if (response.data?.loggedIn) {
          const user = response.data.user;
          user.role_id = Number(user.role_id);
          user.user_id = Number(user.user_id);
          setUserData(user);
          fetchNotifications(user.user_id);
          fetchConversations(user.user_id);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        setLoading(false); // Stop loading after check
      }
    };

    checkUserSession();
  }, []); // ✅ useEffect is always called in the same order

  useEffect(() => {
    const prevPath = previousPathRef.current;
    const isProtectedRoute = PROTECTED_ROUTES.some((route) => location.pathname.startsWith(route));

    // Only track non-auth, non-protected routes as "last accessible" so guest continue has a real destination
    if (!isProtectedRoute && !isAuthPage) {
      setLastAccessiblePath(location.pathname);
      setPendingProtectedReturnPath(null);
    } else if (!userData) {
      const fallback = prevPath === location.pathname ? lastAccessiblePath : prevPath;
      setPendingProtectedReturnPath(fallback || '/home');
    }

    previousPathRef.current = location.pathname;
  }, [location.pathname, userData, lastAccessiblePath, isAuthPage]);

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
      const response = await axios.get('/api/fetch_notifications.php?user_id=${user_id}', {
        withCredentials: true
      });

      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchConversations = async (user_id) => {
    try {
      const response = await axios.get(`/api/fetch_conversations.php?user_id=${user_id}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        const convs = response.data.conversations || [];
        const total = convs.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
        setUnreadMessages(total);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  // Toggle Notification Pop-up
  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
  };

  // Mark Notifications as Read
  const markAllAsRead = async () => {
    try {
      await axios.post('/api/mark_notifications_read.php', { user_id: userData.user_id }, {
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
    navigate('/interest-selection');
  };

  const handleInterestComplete = (schools) => {
    setSelectedSchools(schools);
    navigate('/home');
  };

  // Login
  const handleLogin = (user) => {
    user.role_id = Number(user.role_id);
    user.user_id = Number(user.user_id);
    setUserData(user);
    fetchNotifications(user.user_id);
    fetchConversations(user.user_id);
    navigate('/home');
  };

  // Logout
  const handleLogout = async () => {
    try {
      await axios.post('/api/logout.php', {}, { withCredentials: true });
      setUserData(null);
      setAccountMenuVisible(false);
      navigate('/login');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };
  const openSignUpPage = () => navigate('/signup');
  const openLoginPage = () => navigate('/login');
  const continueAsGuest = () => {
    const target = pendingProtectedReturnPath || lastAccessiblePath || '/home';
    setPendingProtectedReturnPath(null);
    navigate(target);
  };
  const closeProtectedOverlay = () => continueAsGuest();
  const dismissAuthPrompt = () => setRequireAuthOverlay(false);

  const fetchAmbassadors = async () => {
    if (!userData) return;
    setLoadingAmbassadors(true);
    setErrorAmbassadors(null);
  
    try {
      const response = await axios.get(
        `/api/fetch_all_community_ambassadors.php?user_id=${userData.user_id}`,
        { withCredentials: true }
      );
  
      if (response.data.success) {
        setAmbassadors(response.data.ambassadors || []);
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
      axios.get(`/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
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
      setRequireAuthOverlay(true);
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
        axios.get(`/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
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
  
  if (loading) {
    return <div>Loading...</div>;
  }

  const navBarProps = {
    activeFeed,
    setActiveFeed,
    activeSection,
    setActiveSection,
    userData,
    accountMenuVisible,
    setAccountMenuVisible,
    handleLogout,
    toggleNotifications,
    notifications,
    isNotificationsOpen,
    notificationRef,
    markAllAsRead,
    unreadMessages,
    onOpenLogin: openLoginPage,
  };

  const shouldShowOverlays = !isAuthPage;

  return (
    <div className={`app-container ${isAuthPage ? 'auth-page' : ''}`}>
      {shouldShowOverlays && showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-message">
            <h1>Welcome to StudentSphere!</h1>
            <p>Start your journey by following ambassadors who can guide you.</p>
            <button
              className="get-started-button"
              onClick={() => {
                setShowWelcome(false);
                setShowAmbassadorOverlay(true);
                fetchAmbassadors();
              }}
            >
              Get Started
            </button>
            <button onClick={() => setShowWelcome(false)}>Close</button>
          </div>
        </div>
      )}

      {shouldShowOverlays && showAmbassadorOverlay && (
        <div
          className="overlay ambassador-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ambassador-overlay-title"
        >
          <div className="overlay-content">
            <div className="ambassador-overlay__header">
              <div>
                <p className="ambassador-overlay__eyebrow">Community ambassadors</p>
                <h2 id="ambassador-overlay-title">Ambassador List</h2>
                <p className="ambassador-overlay__subtitle">
                  Connect with students and counselors ready to help.
                </p>
              </div>
              <button
                type="button"
                className="ambassador-overlay__close"
                aria-label="Close ambassador list"
                onClick={() => setShowAmbassadorOverlay(false)}
              >
                &times;
              </button>
            </div>

            {loadingAmbassadors ? (
              <p className="ambassador-overlay__status">Loading ambassadors...</p>
            ) : errorAmbassadors ? (
              <p className="ambassador-overlay__status">{errorAmbassadors}</p>
            ) : ambassadors.length === 0 ? (
              <p className="ambassador-overlay__status">No current ambassadors.</p>
            ) : (
              <ul className="ambassador-list" aria-label="Ambassador list">
                {ambassadors.map((amb) => {
                  const isFollowing = followingAmbassadors.includes(amb.user_id);
                  const initials = getInitials(amb.first_name, amb.last_name);
                  const avatarKey = amb.user_id || amb.id || initials;
                  const avatarNode = amb.avatar_path ? (
                    <img
                      src={amb.avatar_path}
                      alt={`${amb.first_name} ${amb.last_name}`}
                      className="ambassador-avatar"
                    />
                  ) : (
                    <div
                      className="ambassador-avatar ambassador-avatar--initial"
                      aria-label={`${amb.first_name} ${amb.last_name}`}
                    >
                      {initials}
                    </div>
                  );

                  return (
                    <li key={avatarKey} className="ambassador-item">
                      {avatarNode}
                      <div className="ambassador-info">
                        <p className="ambassador-name">
                          <Link to={`/user/${amb.user_id}`}>
                            {amb.first_name} {amb.last_name}
                          </Link>
                        </p>
                        <p className="ambassador-headline">{amb.headline}</p>
                      </div>

                      <div className="ambassador-actions">
                        <button
                          className={`follow-button ${isFollowing ? 'unfollow' : 'follow'}`}
                          onClick={() => handleFollowAmbassador(amb.user_id)}
                        >
                          {isFollowing ? 'Unfollow' : 'Follow'}
                        </button>

                        <button
                          className="message-button"
                          onClick={() => alert(`Message ${amb.first_name} ${amb.last_name}`)}
                        >
                          Message
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="ambassador-overlay__footer">
              <button
                type="button"
                className="overlay-ghost"
                onClick={() => setShowAmbassadorOverlay(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Routes>
        <Route
          path="/signup"
          element={<SignUp onNext={handleNext} onShowLogin={openLoginPage} onContinueAsGuest={continueAsGuest} />}
        />
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} onGoToSignUp={openSignUpPage} onContinueAsGuest={continueAsGuest} />}
        />
        <Route
          path="/interest-selection"
          element={<InterestSelection onComplete={handleInterestComplete} />}
        />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route
          path="/profile"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              {userData ? (
                <SelfProfileView userData={userData} />
              ) : (
                <AuthOverlay
                  isOpen
                  onClose={closeProtectedOverlay}
                  onLogin={handleLogin}
                  onGoToSignUp={openSignUpPage}
                  onContinueAsGuest={continueAsGuest}
                />
              )}
            </AppShell>
          }
        />
        <Route
          path="/user/:user_id"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              <UserProfileView userData={userData} />
            </AppShell>
          }
        />
        <Route
          path="*"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              <Routes>
                <Route
                  path="/home"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="home"
                      userData={userData}
                      onRequireAuth={() => setRequireAuthOverlay(true)}
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
                      onRequireAuth={() => setRequireAuthOverlay(true)}
                    />
                  }
                />
                <Route
                  path="/saved"
                  element={
                    userData ? (
                      <Feed
                        activeFeed={activeFeed}
                        setActiveFeed={setActiveFeed}
                        activeSection="saved"
                        userData={userData}
                      />
                    ) : (
                      <AuthOverlay
                        isOpen
                        onClose={closeProtectedOverlay}
                        onLogin={handleLogin}
                        onGoToSignUp={openSignUpPage}
                        onContinueAsGuest={continueAsGuest}
                      />
                    )
                  }
                />
                <Route
                  path="/connections"
                  element={
                    userData ? (
                      <UserConnections userData={userData} />
                    ) : (
                      <AuthOverlay
                        isOpen
                        onClose={closeProtectedOverlay}
                        onLogin={handleLogin}
                        onGoToSignUp={openSignUpPage}
                        onContinueAsGuest={continueAsGuest}
                      />
                    )
                  }
                />
                <Route
                  path="/funding"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="funding"
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
                      onRequireAuth={() => setRequireAuthOverlay(true)}
                    />
                  }
                />
                <Route
                  path="/community-requests"
                  element={
                    userData && userData.email === 'n.sandore5140@gmail.com' ? (
                      <CommunityRequests />
                    ) : (
                      <Navigate to="/communities" />
                    )
                  }
                />
                <Route
                  path="/info/forum/:forum_id"
                  element={<ForumView userData={userData} onRequireAuth={() => setRequireAuthOverlay(true)} />}
                />
                <Route
                  path="/info/forum/:forum_id/thread/:thread_id"
                  element={<ThreadView userData={userData} onRequireAuth={() => setRequireAuthOverlay(true)} />}
                />
                <Route
                  path="/university/:id"
                  element={<UniversityProfile userData={userData} onRequireAuth={() => setRequireAuthOverlay(true)} />}
                />
                <Route
                  path="/group/:id"
                  element={<GroupProfile userData={userData} onRequireAuth={() => setRequireAuthOverlay(true)} />}
                />
                <Route
                  path="/messages"
                  element={<Messages userData={userData} />}
                />
                <Route path="/search" element={<SearchResults />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
      {requireAuthOverlay && (
        <AuthOverlay
          isOpen
          onClose={dismissAuthPrompt}
          onLogin={(user) => {
            setRequireAuthOverlay(false);
            handleLogin(user);
          }}
          onGoToSignUp={() => {
            setRequireAuthOverlay(false);
            openSignUpPage();
          }}
          onContinueAsGuest={dismissAuthPrompt}
        />
      )}
    </div>
  );
}

export default App;
