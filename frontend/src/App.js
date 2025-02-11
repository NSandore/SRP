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
  FaEllipsisV
} from 'react-icons/fa';
import { TbWriting } from 'react-icons/tb';
import { BiInfoCircle } from 'react-icons/bi';
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


function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const notificationRef = useRef(null); // Ref to handle click outside notifications
  useOnClickOutside(notificationRef, () => setIsNotificationsOpen(false));

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://34.31.85.242/api/check_session.php', {
          withCredentials: true
        });
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

  const fetchNotifications = async (user_id) => {
    try {
      const response = await axios.get(`http://34.31.85.242/api/fetch_notifications.php?user_id=${user_id}`, {
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

  return (
    <Router>
      <div className="app-container">
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
              setActiveFeed={setActiveFeed}
              activeSection={activeSection}
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
              <LeftSidebar
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                setActiveFeed={setActiveFeed}
                userData={userData}
              />

              <Routes>
                <Route
                  path="/"
                  element={
                    <Feed
                      activeFeed={activeFeed}
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
                      activeSection="saved"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/connections"
                  element={
                    userData ? <FollowsView userData={userData} /> : <Navigate to="/login" />
                  }
                />
                <Route
                  path="/groups"
                  element={
                    <Feed
                      activeFeed={activeFeed}
                      activeSection="groups"
                      userData={userData}
                    />
                  }
                />
                <Route
                  path="/scholarships"
                  element={
                    <Feed
                      activeFeed={activeFeed}
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
                <Route path="/user/:user_id" element={<UserProfileView />} />
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
  setAccountMenuVisible,
  handleLogout,
  toggleNotifications, 
  notifications, 
  isNotificationsOpen, 
  notificationRef,
  markAllAsRead
}) {
  const unreadCount = notifications.filter(n => parseInt(n.is_read, 10) === 0).length;

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <h2 className="brand-title">StudentSphere</h2>
      </div>

      <div className="nav-center">
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
      </div>

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
              <FaUserCircle className="nav-icon" title="Account Settings" />
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
    { name: 'groups', icon: <FaPeopleCarry />, text: 'Groups' },
    { name: 'scholarships', icon: <RiMedalFill />, text: 'Scholarships' },
    { name: 'communities', icon: <FaUniversity />, text: 'Universities' }
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
function Feed({ activeFeed, activeSection, userData }) {
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

  const fetchAllCommunities = async (page = 1, term = '') => {
    if (!userData) return;
    setIsLoadingAll(true);
    try {
      const response = await axios.get(
        `/api/fetch_all_university_data.php?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`
      );
      if (response.data.communities) {
        setAllCommunities(response.data.communities);
        setTotalPages(response.data.total_pages || 1);
      } else {
        setAllCommunities(response.data);
        setTotalPages(1);
      }
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
    setIsLoadingForums(true);
    try {
      const resp = await axios.get(`/api/fetch_forums.php?community_id=${communityId}`);
      console.log("Fetched forums response:", resp.data);
      // Adjust extraction based on response structure:
      // Use resp.data.forums if it exists; otherwise assume resp.data is the array.
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

  
  useEffect(() => {
    if (activeSection === 'communities' && userData) {
      fetchFollowedCommunities();
      fetchAllCommunities(1, '');
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
  }, [activeSection, userData]);

  useEffect(() => {
    // Debounce search for communities
    const debounce = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunities(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, activeSection]);

  // Pagination
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchAllCommunities(newPage, searchTerm);
    }
  };
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchAllCommunities(newPage, searchTerm);
    }
  };

  // Follow / Unfollow
  const handleFollowToggle = async (communityId, isFollowed) => {
    if (!userData) return;
    try {
      if (isFollowed) {
        await axios.post('/api/unfollow_communities.php', {
          user_id: userData.user_id,
          community_id: communityId
        });
      } else {
        await axios.post('/api/follow_communities.php', {
          user_id: userData.user_id,
          community_id: communityId
        });
      }
      fetchFollowedCommunities();
      fetchAllCommunities(currentPage, searchTerm);
    } catch (error) {
      console.error('Error toggling follow status:', error);
      alert('An error occurred while updating follow status.');
    }
  };

  // Create a set for quick lookup
  const followedIds = new Set(followedCommunities.map((c) => c.community_id));

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
  if (activeSection === 'home') {
    mockPosts =
      activeFeed === 'yourFeed'
        ? [
            { title: 'Q&A: Admissions Advice...', author: 'StaffMember123', content: 'Ask your questions...' },
            { title: 'Top Scholarship Opportunities...', author: 'ScholarBot', content: 'Check out these...' },
            { title: 'New Poll: Which Club...', author: 'StudentRep', content: 'Vote on which club...' }
          ]
        : [
            { title: 'Explore: Upcoming Tech Webinars', author: 'TechGuru', content: 'Join us...' },
            { title: 'Discover: Study Abroad...', author: 'TravelAdvisor', content: 'Find out...' },
            { title: 'Trending: Eco-Friendly...', author: 'GreenScholar', content: 'Learn about...' }
          ];
  } else if (activeSection === 'connections') {
    mockPosts = [{ title: 'Connections Updates', author: 'ConnectionBot', content: 'Your connections are up to...' }];
  } else if (activeSection === 'groups') {
    mockPosts = [{ title: 'Group Discussions', author: 'GroupAdmin', content: 'Latest discussions in your groups...' }];
  } else if (activeSection === 'scholarships') {
    mockPosts = [{ title: 'Scholarship Board', author: 'ScholarBot', content: 'Available scholarships...' }];
  }

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
          {userData?.role_id === 3 && (
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

          <h2 className="forum-title">Forums</h2>
          {isLoadingForums ? (
            <p>Loading forums...</p>
          ) : forums.length === 0 ? (
            <p>No forums available.</p>
          ) : (
            <div className="forum-list">
              {forums.map((forum) => {
                const canEditDeleteForum = userData?.role_id === 3;
                // Check if forum is saved
                const isSaved = savedForums.some((sf) => sf.forum_id === forum.forum_id);

                return (
                  <div key={forum.forum_id} className="forum-card" style={{ marginBottom: '1rem', position: 'relative' }}>
                    {/* 3-dot icon */}
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
                            onClick={() => handleSaveForum(forum.forum_id, isSaved)}
                          >
                            {isSaved ? 'Unsave' : 'Save'}
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
                          onClick={() => alert(`Report forum with ID ${forum.forum_id}`)}
                        >
                          Report
                        </button>
                      </div>
                    )}

                    <Link to={`/info/forum/${forum.forum_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 className="forum-title">{forum.name}</h3>
                      <p className="forum-description">{forum.description}</p>
                    </Link>

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
            <h3>Your Followed Universities</h3>
            {isLoadingFollowed ? (
              <p>Loading followed universities...</p>
            ) : followedCommunities.length === 0 ? (
              <p>You are not following any universities yet.</p>
            ) : (
              <div className="community-grid">
                {followedCommunities.map((school) => (
                  <div key={school.community_id} className="community-card followed">
                    <img
                      src={school.logo_path || '/uploads/logos/default-logo.png'}
                      alt={`${school.name} Logo`}
                      className="community-logo"
                    />
                    {/* Ensure the link uses the correct `community_type` */}
                    <Link
                      to={`/${school.community_type}/${school.community_id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <h4 className="community-name">{school.name}</h4>
                    </Link>
                    <p className="community-location">{school.location}</p>
                    {school.tagline && <p className="community-tagline">{school.tagline}</p>}
                    <p className="followers-count">{school.followers_count} Followers</p>
                    <button
                      className="follow-button unfollow"
                      onClick={() => handleFollowToggle(school.community_id, true)}
                    >
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="search-bar-container">
            <label htmlFor="community-search" className="visually-hidden">
              Search Communities
            </label>
            <input
              id="community-search"
              type="text"
              placeholder="Search communities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="community-search-bar"
            />
          </div>

          <div className="communities-section">
            <h3>All Universities</h3>
            {isLoadingAll || !allCommunities ? (
              <p>Loading all universities...</p>
            ) : allCommunities.length > 0 ? (
              <div className="community-grid">
                {allCommunities
                  .filter((community) => !followedIds.has(community.community_id))
                  .map((community) => (
                    <div key={community.community_id} className="community-card">
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
                        className="follow-button follow"
                        onClick={() => handleFollowToggle(community.community_id, false)}
                      >
                        Follow
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p>No universities found.</p>
            )}
            <div className="pagination-controls">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Next
              </button>
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
      {['home', 'connections', 'groups', 'scholarships'].includes(activeSection) && (
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
