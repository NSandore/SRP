// src/App.js

import React, { useEffect, useRef, useState } from 'react';
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
import { DEV_MODE } from './config';
import ContactUsButton from './components/ContactUsButton';
import ChangelogModal from './components/ChangelogModal';
import ChangelogPage from './components/ChangelogPage';
import ChangelogAdmin from './components/ChangelogAdmin';
import ProductTour from './components/ProductTour';
import { PrivacyPolicyPage, TermsPage } from './components/LegalPage';
import SearchResults from './components/SearchResults';
import CommunityRequests from './components/CommunityRequests';
import AuthOverlay from './components/AuthOverlay';
import AccountSettings from './components/AccountSettings';
import ReportedItems from './components/ReportedItems';
import EventManagement from './components/EventManagement';
import EventsFeed from './components/EventsFeed';
import PollsPage from './components/PollsPage';
import DonationPage from './components/DonationPage';
import { buildAvatarSrc } from './utils/avatar';
import VerificationReview from './components/VerificationReview';
import Newsroom from './components/Newsroom';
import ReelsPage from './components/ReelsPage';
import InstitutionDataReview from './components/InstitutionDataReview';
import './layout/PlatformPolish.css';

const PROTECTED_ROUTES = ['/profile', '/saved', '/connections', '/settings', '/reports', '/events', '/polls', '/admin/verifications', '/admin/institutions', '/admin/newsroom', '/admin/changelog'];
const AUTH_ROUTES = ['/login', '/signup'];

// "Continue as guest" must land somewhere a signed-out visitor can actually
// stay. Sending them to a protected route re-prompts for login, and sending
// them to an auth route is the login page itself, so either choice loops.
const isGuestAccessiblePath = (path) =>
  typeof path === 'string'
  && path.startsWith('/')
  && !AUTH_ROUTES.includes(path)
  && !PROTECTED_ROUTES.some((route) => path.startsWith(route));

function App() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [userInterests, setUserInterests] = useState([]);
  const [activeFeed, setActiveFeed] = useState(() => {
    if (typeof window === 'undefined') return 'explore';
    return localStorage.getItem('defaultFeed') || 'explore';
  });
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
  const [toasts, setToasts] = useState([]);
  const prevUnreadNotifs = useRef(0);
  const prevUnreadMessages = useRef(0);
  const notifInitRef = useRef(false);
  const messageInitRef = useRef(false);
  const audioRef = useRef(null);
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  const [showWelcome, setShowWelcome] = useState(false);

  const getInitials = (firstName = '', lastName = '') => {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || 'A';
  };

  const pushToast = (message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const playNotificationSound = () => {
    if (!soundUnlocked) return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const notificationRef = useRef(null); // Ref to handle click outside notifications
  useOnClickOutside(notificationRef, () => setIsNotificationsOpen(false));
  const navigate = useNavigate();
  const location = useLocation();
  const authRoutes = AUTH_ROUTES;
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
          setUserData(user);
          fetchNotifications(user.user_id);
          fetchConversations(user.user_id);
          // Apply default feed preference: server setting > localStorage > fallback
          if (typeof window !== 'undefined') {
            const stored = user.default_feed || localStorage.getItem('defaultFeed');
            const mapped = stored === 'yourFeed' ? 'explore' : stored; // map legacy
            const finalFeed = stored ? stored : 'explore';
            setActiveFeed(finalFeed);
            localStorage.setItem('defaultFeed', finalFeed);
          }
        } else if (DEV_MODE && typeof window !== 'undefined') {
          const storedUserId = localStorage.getItem('user_id');
          if (storedUserId) {
            setUserData((prev) => ({
              ...prev,
              user_id: storedUserId,
              role_id: Number(prev?.role_id || 0),
              is_ambassador: Number(prev?.is_ambassador || 0),
            }));
          }
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        setLoading(false); // Stop loading after check
      }
    };

    checkUserSession();
  }, []); // ✅ useEffect is always called in the same order

  const refreshUserInterests = React.useCallback(async (overrideUserId) => {
    const uid = overrideUserId || userData?.user_id;
    if (!uid) return;
    try {
      const resp = await axios.get(`/api/fetch_tag_interests.php?user_id=${uid}`, {
        withCredentials: true
      });
      if (resp.data?.success) {
        setUserInterests(Array.isArray(resp.data.tags) ? resp.data.tags : []);
      }
    } catch (err) {
      console.error('Error fetching user interests:', err);
    }
  }, [userData?.user_id]);

  useEffect(() => {
    refreshUserInterests();
  }, [refreshUserInterests]);

  useEffect(() => {
    const prevPath = previousPathRef.current;
    const isProtectedRoute = PROTECTED_ROUTES.some((route) => location.pathname.startsWith(route));

    // Only track non-auth, non-protected routes as "last accessible" so guest continue has a real destination
    if (!isProtectedRoute && !isAuthPage) {
      setLastAccessiblePath(location.pathname);
      setPendingProtectedReturnPath(null);
    } else if (!userData) {
      const fallback = prevPath === location.pathname ? lastAccessiblePath : prevPath;
      // The previous path is only a usable return target if a guest may stay
      // there. Otherwise leave it unset and fall back to a known-safe path.
      setPendingProtectedReturnPath(isGuestAccessiblePath(fallback) ? fallback : null);
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
      const response = await axios.get(`/api/fetch_notifications.php?user_id=${user_id}`, {
        withCredentials: true
      });

      if (response.data.success) {
        const list = response.data.notifications || [];
        setNotifications(list);
        const unread = list.filter((n) => parseInt(n.is_read, 10) === 0).length;
        if (notifInitRef.current && unread > prevUnreadNotifs.current) {
          pushToast('You have new notifications');
          playNotificationSound();
        }
        notifInitRef.current = true;
        prevUnreadNotifs.current = unread;
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const sendFollowNotification = async (followedId, followerId) => {
    const actorId = followerId || userData?.user_id;
    if (!actorId || !followedId || Number(actorId) === Number(followedId)) return;
    const payload = new URLSearchParams();
    payload.append('follower_id', actorId);
    payload.append('followed_id', followedId);
    try {
      await axios.post(
        '/api/add_follow_notification.php',
        payload,
        { withCredentials: true }
      );
    } catch (err) {
      // Non-blocking: log for visibility but don’t interrupt the UI
      console.error('Error sending follow notification:', err);
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
        if (messageInitRef.current && total > prevUnreadMessages.current) {
          pushToast('You have new messages');
          playNotificationSound();
        }
        messageInitRef.current = true;
        prevUnreadMessages.current = total;
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  // Toggle Notification Pop-up
  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
  };

  const refreshNotifications = () => {
    if (userData?.user_id) {
      fetchNotifications(userData.user_id);
    }
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

  const handleSignupAuthenticated = (user) => {
    if (!user) return;
    user.role_id = Number(user.role_id);
    setUserData(user);
    fetchNotifications(user.user_id);
    fetchConversations(user.user_id);
    refreshUserInterests(user.user_id);
  };

  // Login
  const handleLogin = (user) => {
    user.role_id = Number(user.role_id);
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
    // Guarded here as well as at the point the return path is recorded, so no
    // future caller can send a guest back to a page that re-prompts for login.
    const target =
      [pendingProtectedReturnPath, lastAccessiblePath].find(isGuestAccessiblePath)
      || '/home';
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

  useEffect(() => {
    if (!userData?.user_id) return undefined;
    // Initial refresh when user state is set (e.g., session restore)
    fetchNotifications(userData.user_id);
    fetchConversations(userData.user_id);

    const pollIntervalMs = 10000;
    const intervalId = setInterval(() => {
      fetchNotifications(userData.user_id);
      fetchConversations(userData.user_id);
    }, pollIntervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(userData.user_id);
        fetchConversations(userData.user_id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userData]);

  useEffect(() => {
    const unlockSound = () => {
      if (!audioRef.current || soundUnlocked) return;
      // Attempt a muted play/pause to satisfy user-gesture policies
      const el = audioRef.current;
      const prevMuted = el.muted;
      el.muted = true;
      el.currentTime = 0;
      el.play().then(() => {
        el.pause();
        el.muted = prevMuted;
        setSoundUnlocked(true);
      }).catch(() => {
        el.muted = prevMuted;
      });
    };
    window.addEventListener('click', unlockSound, { once: true });
    window.addEventListener('touchstart', unlockSound, { once: true });
    window.addEventListener('keydown', unlockSound, { once: true });
    return () => {
      window.removeEventListener('click', unlockSound);
      window.removeEventListener('touchstart', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, [soundUnlocked]);
  
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
        if (!isFollowing) {
          sendFollowNotification(ambassadorId, userData.user_id);
        }
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
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className="toast app-notification-toast" role="status">
            <span className="toast-icon" aria-hidden="true">
              <FaBell />
            </span>
            <span className="toast-copy">{t.message}</span>
          </div>
        ))}
      </div>
      {shouldShowOverlays && showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-message">
            <div className="welcome-kicker">Welcome to StudentSphere</div>
            <h1>Find the people who have already walked your path.</h1>
            <p>Start by following ambassadors who can guide you with real, on-campus advice.</p>
            <div className="welcome-actions">
              <button
                className="get-started-button"
                onClick={() => {
                  setShowWelcome(false);
                  setShowAmbassadorOverlay(true);
                  fetchAmbassadors();
                }}
              >
                Explore ambassadors
              </button>
              <button className="welcome-secondary" onClick={() => setShowWelcome(false)}>
                Not now
              </button>
            </div>
            <div className="welcome-footnote">You can open this any time from your campus page.</div>
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
              <div className="ambassador-overlay__titleblock">
                <p className="ambassador-overlay__eyebrow">Community ambassadors</p>
                <h2 id="ambassador-overlay-title">Ambassador List</h2>
                <p className="ambassador-overlay__subtitle">
                  Connect with ambassadors from the communities you follow and are part of.
                </p>
                <div className="ambassador-overlay__meta">
                  <span className="ambassador-overlay__meta-item">Verified students</span>
                  <span className="ambassador-overlay__meta-item">Real campus guidance</span>
                </div>
              </div>
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
                      src={buildAvatarSrc(amb.avatar_path)}
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

      {/* Both read their own eligibility from the server and render nothing
          when there is nothing to show, so mounting them here is safe. The
          tour waits for onboarding to finish; the changelog waits for an entry
          published since the user last acknowledged one. */}
      {shouldShowOverlays && <ChangelogModal userData={userData} />}
      {shouldShowOverlays && <ProductTour userData={userData} />}

      <Routes>
        <Route
          path="/signup"
          element={<SignUp onAuthenticated={handleSignupAuthenticated} onShowLogin={openLoginPage} onContinueAsGuest={continueAsGuest} />}
        />
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} onGoToSignUp={openSignUpPage} onContinueAsGuest={continueAsGuest} />}
        />
        <Route
          path="/interest-selection"
          element={<Navigate to="/signup" replace />}
        />
        <Route path="/" element={<Navigate to="/home" replace />} />
        {/* Public: guests following "See full changelog" must not hit a login
            prompt, so this stays out of PROTECTED_ROUTES. */}
        <Route
          path="/changelog"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              <ChangelogPage />
            </AppShell>
          }
        />
        <Route
          path="/privacy"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              <PrivacyPolicyPage />
            </AppShell>
          }
        />
        <Route
          path="/terms"
          element={
            <AppShell navBarProps={navBarProps} userData={userData}>
              <TermsPage />
            </AppShell>
          }
        />
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
              <UserProfileView
                userData={userData}
                onFollowNotification={sendFollowNotification}
                onNotificationsRefresh={refreshNotifications}
              />
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
                      userInterests={userInterests}
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
                      userInterests={userInterests}
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
                        userInterests={userInterests}
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
                  path="/settings"
                  element={
                    userData ? (
                      <AccountSettings userData={userData} onInterestsUpdated={refreshUserInterests} />
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
                <Route path="/donate" element={<DonationPage />} />
                <Route
                  path="/funding"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      setActiveFeed={setActiveFeed}
                      activeSection="funding"
                      userData={userData}
                      userInterests={userInterests}
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
                      userInterests={userInterests}
                      onRequireAuth={() => setRequireAuthOverlay(true)}
                    />
                  }
                />
                <Route
                  path="/reels"
                  element={
                    <ReelsPage
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
                  element={
                    <UniversityProfile
                      userData={userData}
                      onRequireAuth={() => setRequireAuthOverlay(true)}
                      onFollowNotification={sendFollowNotification}
                      onNotificationsRefresh={refreshNotifications}
                    />
                  }
                />
                <Route
                  path="/group/:id"
                  element={<GroupProfile userData={userData} onRequireAuth={() => setRequireAuthOverlay(true)} />}
                />
                <Route
                  path="/messages"
                  element={<Messages userData={userData} />}
                />
                <Route
                  path="/reports"
                  element={
                    userData ? (
                      <ReportedItems userData={userData} />
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
                  path="/events"
                  element={
                    userData ? (
                      <EventManagement userData={userData} />
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
                  path="/events-feed"
                  element={<EventsFeed userData={userData} />}
                />
                <Route
                  path="/polls"
                  element={
                    userData ? (
                      <PollsPage userData={userData} />
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
                  path="/admin/verifications"
                  element={
                    userData ? (
                      <VerificationReview userData={userData} />
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
                  path="/admin/institutions"
                  element={
                    userData ? (
                      <InstitutionDataReview userData={userData} />
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
                  path="/admin/newsroom"
                  element={
                    userData ? (
                      <Newsroom userData={userData} />
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
                  path="/admin/changelog"
                  element={
                    userData ? (
                      <ChangelogAdmin userData={userData} />
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
