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
import LeftSidebar from './components/LeftSidebar';
import NavBar from './components/NavBar';
import ForumCard from './components/ForumCard';
import Feed from './components/Feed';
import ContactUsButton from './components/ContactUsButton';
import SearchResults from './components/SearchResults';


function App() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
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
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [showWelcome, setShowWelcome] = useState(false);

  const notificationRef = useRef(null); // Ref to handle click outside notifications
  useOnClickOutside(notificationRef, () => setIsNotificationsOpen(false));

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://172.16.11.133/api/check_session.php', {
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
      const response = await axios.get('http://172.16.11.133/api/fetch_notifications.php?user_id=${user_id}', {
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
      const response = await axios.get(`http://172.16.11.133/api/fetch_conversations.php?user_id=${user_id}`, {
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
      await axios.post('http://172.16.11.133/api/mark_notifications_read.php', { user_id: userData.user_id }, {
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
    fetchNotifications(user.user_id);
    fetchConversations(user.user_id);
    setStep(0);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await axios.post('http://172.16.11.133/api/logout.php', {}, { withCredentials: true });
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
        `http://172.16.11.133/api/fetch_all_community_ambassadors.php?user_id=${userData.user_id}`,
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
      axios.get(`http://172.16.11.133/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
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
        axios.get(`http://172.16.11.133/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
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
    <div>
      {loading ? (
        <div>Loading...</div> // ✅ No early return, so all hooks are always called
      ) : (
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
                      setShowWelcome(false); // Close welcome overlay
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
            {step === 2 && <Login onLogin={handleLogin} onGoToSignUp={() => setStep(1)} />}
            {step === 3 && <InterestSelection onComplete={handleInterestComplete} />}
  
            {step === 0 && (
              <>
                <NavBar
                  activeFeed={activeFeed}
                  setStep={setStep}
                  setActiveFeed={setActiveFeed}
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
                  unreadMessages={unreadMessages}
                />
  
                <Routes>
                  {/* Profile and User Profile Views (2-column layout) */}
                  <Route
                    path="/profile"
                    element={
                      <div className="profile-page-main-content">
                        {userData ? <SelfProfileView userData={userData} /> : <Navigate to="/login" />}
                        <RightSidebar />
                        <ContactUsButton />
                      </div>
                    }
                  />
                  
                  <Route
                    path="/user/:user_id"
                    element={
                      <div className="profile-page-main-content">
                        <UserProfileView userData={userData} />
                        <RightSidebar />
                      </div>
                    }
                  />
  
                  {/* Default layout for all other routes */}
                  <Route
                    path="*"
                    element={
                      <div className="main-content">
                        <LeftSidebar />
                        <Routes>
                          {/* Home */}
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

                          {/* Info */}
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

                          {/* Saved */}
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

                          {/* Connections (requires login) */}
                          <Route
                            path="/connections"
                            element={
                              userData ? <UserConnections userData={userData} /> : <Navigate to="/login" />
                            }
                          />

                          {/* Funding */}
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

                          {/* Communities */}
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

                          {/* Forum & Thread Views */}
                          <Route
                            path="/info/forum/:forum_id"
                            element={<ForumView userData={userData} />}
                          />
                          <Route
                            path="/info/forum/:forum_id/thread/:thread_id"
                            element={<ThreadView userData={userData} />}
                          />

                          {/* University & Group Profiles */}
                          <Route
                            path="/university/:id"
                            element={<UniversityProfile userData={userData} />}
                          />
                          <Route
                            path="/group/:id"
                            element={<GroupProfile userData={userData} />}
                          />

                          {/* Messages */}
                          <Route
                            path="/messages"
                            element={<Messages userData={userData} />}
                          />
                          <Route path="/search" element={<SearchResults />} />
                        </Routes>
                        <RightSidebar />
                        <ContactUsButton />
                      </div>
                    }
                  />
                </Routes>
              </>
            )}
          </div>
        </Router>
      )}
    </div>
  );  
}
export default App;
