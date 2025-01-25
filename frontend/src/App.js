// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from 'react-router-dom';
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
  FaPeopleCarry
} from 'react-icons/fa';
import { TbWriting } from 'react-icons/tb';
import { BiInfoCircle } from 'react-icons/bi';
import SignUp from './components/SignUp';
import InterestSelection from './components/InterestSelection';
import Login from './components/Login';
import { RiMedalFill } from 'react-icons/ri';
import ForumView from './components/ForumView';   // Forum details + threads
import ThreadView from './components/ThreadView'; // Thread details
// (Optional) import CreateForumModal from './components/CreateForumModal'; // If you had a separate component

function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);

  // Check user session on initial mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://34.31.85.242/api/check_session.php', {
          withCredentials: true
        });
        if (response.data && response.data.loggedIn) {
          const user = response.data.user;
          // Convert string IDs to numbers
          user.role_id = Number(user.role_id);
          user.user_id = Number(user.user_id);
          setUserData(user);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };
    checkUserSession();
  }, []);

  // Handlers for stepping through onboarding
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
          <InterestSelection 
            onComplete={handleInterestComplete} 
          />
        )}

        {step === 0 && (
          <>
            <NavBar
              setStep={setStep}
              activeFeed={activeFeed}
              setActiveFeed={setActiveFeed}
              activeSection={activeSection}
              userData={userData}
              accountMenuVisible={accountMenuVisible}
              setAccountMenuVisible={setAccountMenuVisible}
              handleLogout={handleLogout}
            />
            <div className="main-content">
              <LeftSidebar
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                setActiveFeed={setActiveFeed}
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
                    <Feed
                      activeFeed={activeFeed}
                      activeSection="connections"
                      userData={userData}
                    />
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

                {/* Forum + Thread routes */}
                <Route
                  path="/info/forum/:forum_id"
                  element={<ForumView userData={userData} />}
                />
                <Route
                  path="/info/forum/:forum_id/thread/:thread_id"
                  element={<ThreadView userData={userData} />}
                />
              </Routes>
              <RightSidebar />
            </div>
          </>
        )}
      </div>
    </Router>
  );
}

/**
 * NavBar
 */
function NavBar({
  setStep,
  activeFeed,
  setActiveFeed,
  activeSection,
  userData,
  accountMenuVisible,
  setAccountMenuVisible,
  handleLogout
}) {
  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <h2 className="brand-title">StudentSphere</h2>
      </div>

      <div className="nav-center">
        {activeSection === 'home' && (
          <div className="feed-options">
            <button
              className={`feed-option-button ${
                activeFeed === 'yourFeed' ? 'active' : ''
              }`}
              onClick={() => setActiveFeed('yourFeed')}
            >
              Your Feed
            </button>
            <button
              className={`feed-option-button ${
                activeFeed === 'suggested' ? 'active' : ''
              }`}
              onClick={() => setActiveFeed('suggested')}
            >
              Explore
            </button>
          </div>
        )}
      </div>

      <div className="nav-right">
        <div className="nav-icons">
          <FaEnvelope className="nav-icon" title="Messages" />
          <FaBell className="nav-icon" title="Notifications" />
          {userData && (
            <div
              className="account-settings"
              onClick={() => setAccountMenuVisible(!accountMenuVisible)}
            >
              <FaUserCircle className="nav-icon" title="Account Settings" />
              {accountMenuVisible && (
                <div className="account-menu">
                  <div
                    className="account-menu-item"
                    onClick={() => alert('Account Settings')}
                  >
                    Account Settings
                  </div>
                  <div className="account-menu-item" onClick={handleLogout}>
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
            onClick={() => setStep(2)}
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}

/**
 * LeftSidebar
 */
function LeftSidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeSection,
  setActiveSection,
  setActiveFeed
}) {
  const navigate = useNavigate();

  const handleSectionClick = (section) => {
    setActiveSection(section);
    setActiveFeed('yourFeed'); // optionally reset feed
    navigate(`/${section}`);
  };

  const sidebarItems = [
    { name: 'home', icon: <TbWriting />, text: 'Home' },
    { name: 'info', icon: <BiInfoCircle />, text: 'Information Board' },
    { name: 'saved', icon: <FaBookmark />, text: 'Saved' },
    { name: 'connections', icon: <FaUsers />, text: 'Connections' },
    { name: 'groups', icon: <FaPeopleCarry />, text: 'Groups' },
    { name: 'scholarships', icon: <RiMedalFill />, text: 'Scholarships' },
    { name: 'communities', icon: <FaUniversity />, text: 'Universities' }
  ];

  return (
    <aside
      className={`left-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
    >
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
            className={`sidebar-item ${
              activeSection === item.name ? 'active' : ''
            }`}
            onClick={() => handleSectionClick(item.name)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export { LeftSidebar };

/**
 * Feed Component (Handles the "Information Board" + "Communities" + other sections)
 */
function Feed({ activeFeed, activeSection, userData }) {
  // Followed communities
  const [followedCommunities, setFollowedCommunities] = useState([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);

  // All communities
  const [allCommunities, setAllCommunities] = useState([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Forums
  const [forums, setForums] = useState([]);
  const [isLoadingForums, setIsLoadingForums] = useState(false);

  // Create Forum Modal
  const [showCreateForumModal, setShowCreateForumModal] = useState(false);
  const [newForumName, setNewForumName] = useState('');
  const [newForumDescription, setNewForumDescription] = useState('');
  const [isCreatingForum, setIsCreatingForum] = useState(false);

  // Edit / Delete Forum States
  const [editForumId, setEditForumId] = useState(null);
  const [editForumName, setEditForumName] = useState('');
  const [editForumDescription, setEditForumDescription] = useState('');
  const [isEditingForum, setIsEditingForum] = useState(false);

  // Notification
  const [notification, setNotification] = useState(null);

  //
  // 1) Fetch Followed Communities
  //
  const fetchFollowedCommunities = async () => {
    if (!userData) return;
    setIsLoadingFollowed(true);
    try {
      const response = await axios.get(
        `/api/followed_communities.php?user_id=${userData.user_id}`
      );
      if (Array.isArray(response.data)) {
        setFollowedCommunities(response.data);
      } else {
        setFollowedCommunities([]);
      }
    } catch (error) {
      console.error('Error fetching followed communities:', error);
      setFollowedCommunities([]);
    } finally {
      setIsLoadingFollowed(false);
    }
  };

  //
  // 2) Fetch All Communities (with search & pagination)
  //
  const fetchAllCommunities = async (page = 1, term = '') => {
    if (!userData) {
      return;
    }
    setIsLoadingAll(true);
    try {
      const response = await axios.get(
        `/api/fetch_all_community_data.php?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`
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
      setForums(resp.data || []);
    } catch (error) {
      console.error('Error fetching forums:', error);
      setForums([]);
    } finally {
      setIsLoadingForums(false);
    }
  };

  // Called once or on userData changes
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
    }
  }, [activeSection, userData]);

  // Handle search changes with small debounce
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunities(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, activeSection]);

  // For Next/Prev page
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

  //
  // 4) Follow / Unfollow a community
  //
  const handleFollowToggle = async (communityId, isFollowed) => {
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
  } else if (activeSection === 'saved') {
    mockPosts = [{ title: 'Your Saved Posts', author: 'You', content: 'Here are your saved posts...' }];
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

      {activeSection === 'info' ? (
        <>
          {/* Show Create Forum Button if user is role_id=3 */}
          {userData?.role_id === 3 && (
            <button
              className="create-button"
              onClick={() => setShowCreateForumModal(true)}
            >
              Create Forum
            </button>
          )}

          {/* Create Forum Modal */}
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
                    <button
                      type="submit"
                      disabled={isCreatingForum}
                    >
                      {isCreatingForum ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForumModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Forum Modal */}
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
                    <button
                      type="button"
                      onClick={cancelEditingForum}
                    >
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
                // Only Admins (role_id=3) can see Edit/Delete
                const canEditDeleteForum = userData?.role_id === 3;

                return (
                  <div key={forum.forum_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                    {/* Link to the actual forum view */}
                    <Link
                      to={`/info/forum/${forum.forum_id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <h3 className="forum-title">{forum.name}</h3>
                      <p className="forum-description">{forum.description}</p>
                    </Link>

                    {canEditDeleteForum && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        {/* Edit */}
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

                        {/* Delete */}
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
      ) : (
        <p>Select a section to display relevant content.</p>
      )}

      {activeSection === 'communities' && (
        <>
          {/* Followed Communities */}
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
                    <h4 className="community-name">{school.name}</h4>
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

          {/* Search Bar */}
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

          {/* All Communities */}
          <div className="communities-section">
            <h3>All Universities</h3>
            {isLoadingAll ? (
              <p>Loading all universities...</p>
            ) : allCommunities.length === 0 ? (
              <p>No universities found.</p>
            ) : (
              <div className="community-grid">
                {allCommunities
                  // Exclude ones user already follows
                  .filter((community) => !followedIds.has(community.community_id))
                  .map((community) => (
                    <div key={community.community_id} className="community-card">
                      <img
                        src={community.logo_path || '/uploads/logos/default-logo.png'}
                        alt={`${community.name} Logo`}
                        className="community-logo"
                        loading="lazy"
                      />
                      <h4 className="community-name">{community.name}</h4>
                      <p className="community-location">{community.location}</p>
                      {community.tagline && (
                        <p className="community-tagline">{community.tagline}</p>
                      )}
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

      {/* If we’re not in "info" or "communities," we render mockPosts: */}
      {(activeSection !== 'info' && activeSection !== 'communities') &&
        mockPosts.map((post, i) => (
          <div key={i} className="post-card">
            <h3>{post.title}</h3>
            <small>Posted by {post.author}</small>
            <p>{post.content}</p>
          </div>
        ))
      }

      {/* Notifications */}
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

/**
 * RightSidebar
 */
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

export default App;
