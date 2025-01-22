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
import ForumView from './components/ForumView';   // New component for forum details
import ThreadView from './components/ThreadView'; // New component for thread details


function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://34.31.85.242/api/check_session.php', { withCredentials: true });
        if (response.data && response.data.loggedIn) {
          setUserData(response.data.user);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };
    checkUserSession();
  }, []);

  const handleNext = (formData) => {
    setUserData(formData);
    setStep(3);
  };

  const handleInterestComplete = (schools) => {
    setSelectedSchools(schools);
    setStep(0);
  };

  const handleLogin = (user) => {
    setUserData(user);
    setStep(0);
  };

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
        {step === 2 && <Login onLogin={handleLogin} onGoToSignUp={() => setStep(1)} />}
        {step === 3 && <InterestSelection onComplete={handleInterestComplete} />}
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
                <Route path="/" element={<Feed activeFeed={activeFeed} activeSection="home" userData={userData} />} />
                <Route path="/info" element={<Feed activeFeed={activeFeed} activeSection="info" userData={userData} />} />
                <Route path="/saved" element={<Feed activeFeed={activeFeed} activeSection="saved" userData={userData} />} />
                <Route path="/connections" element={<Feed activeFeed={activeFeed} activeSection="connections" userData={userData} />} />
                <Route path="/groups" element={<Feed activeFeed={activeFeed} activeSection="groups" userData={userData} />} />
                <Route path="/scholarships" element={<Feed activeFeed={activeFeed} activeSection="scholarships" userData={userData} />} />
                <Route path="/communities" element={<Feed activeFeed={activeFeed} activeSection="communities" userData={userData} />} />
                <Route path="/info/forum/:forum_id" element={<ForumView userData={userData} />} />
                <Route path="/info/forum/:forum_id/thread/:thread_id" element={<ThreadView userData={userData} />} />
              </Routes>
              <RightSidebar />
            </div>
          </>
        )}
      </div>
    </Router>
  );
}

function NavBar({ setStep, activeFeed, setActiveFeed, activeSection, userData, accountMenuVisible, setAccountMenuVisible, handleLogout }) {
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
          <FaEnvelope className="nav-icon" title="Messages" />
          <FaBell className="nav-icon" title="Notifications" />
          {userData && (
            <div className="account-settings" onClick={() => setAccountMenuVisible(!accountMenuVisible)}>
              <FaUserCircle className="nav-icon" title="Account Settings" />
              {accountMenuVisible && (
                <div className="account-menu">
                  <div className="account-menu-item" onClick={() => alert('Account Settings')}>
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
          <button className="nav-button" onClick={() => setStep(2)}>Login</button>
        )}
      </div>
    </nav>
  );
}

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
    setActiveFeed('yourFeed'); // Optionally reset feed when changing section
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

        {sidebarItems.map(item => (
          <li 
            key={item.name} 
            className={`sidebar-item ${activeSection === item.name ? 'active' : ''}`}
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


function Feed({ activeFeed, activeSection, userData }) {
  const [followedCommunities, setfollowedCommunities] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [forums, setForums] = useState([]);
  const [isLoadingForums, setIsLoadingForums] = useState(false);

  // Fetch followed communities (communities the user follows)
  const fetchfollowedCommunities = async () => {
    if (!userData) return;
    setIsLoadingFollowed(true);
    try {
      console.log("Fetching followed communities...");
      const response = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
      console.log("Followed Communities Response:", response.data);
      if (Array.isArray(response.data)) {
        setfollowedCommunities(response.data);
      } else {
        setfollowedCommunities([]);
      }
    } catch (error) {
      console.error('Error fetching followed communities:', error);
      setfollowedCommunities([]);
    } finally {
      setIsLoadingFollowed(false);
    }
  };

  // Fetch all communities (paginated and searchable)
  const fetchAllCommunities = async (page = 1, term = '') => {
    if (!userData) {
      // Silently return if userData is not available
      return;
    }
    setIsLoadingAll(true);
    try {
      console.log(`Fetching all communities... page: ${page}, term: "${term}"`);
      const response = await axios.get(`/api/fetch_all_community_data.php?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`);
      console.log("All Communities Response:", response.data);
      
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

  const fetchForums = async (communityId) => {
    setIsLoadingForums(true);
    try {
      const response = await axios.get(`/api/fetch_forums.php?community_id=${communityId}`);
      setForums(response.data || []);
    } catch (error) {
      console.error('Error fetching forums:', error);
      setForums([]);
    } finally {
      setIsLoadingForums(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'communities' && userData) {
      console.log("Communities section active and userData available. Fetching data...");
      fetchfollowedCommunities();
      fetchAllCommunities(1, '');
      setCurrentPage(1);
      setSearchTerm('');
    }
    if (activeSection === 'info') {
      fetchForums(3); // Forums for community_id = 3
    }
  }, [activeSection, userData]); // Trigger only when section changes to communities and userData is set

  // Handle search changes with debouncing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunities(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle pagination
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

  // Implement Follow/Unfollow Functionality
  const handleFollowToggle = async (communityId, isFollowed) => {
    try {
      if (isFollowed) {
        // Unfollow the community
        await axios.post('/api/unfollow_community.php', { user_id: userData.user_id, community_id: communityId });
      } else {
        // Follow the community
        await axios.post('/api/follow_community.php', { user_id: userData.user_id, community_id: communityId });
      }
      // Refresh both followed and all communities lists
      fetchfollowedCommunities();
      fetchAllCommunities(currentPage, searchTerm);
    } catch (error) {
      console.error('Error toggling follow status:', error);
      alert('An error occurred while updating follow status.');
    }
  };

  // Create a Set of followed community IDs for efficient lookup
  const followedIds = new Set(followedCommunities.map(u => u.community_id));

  // For non-communities sections
  let mockPosts = [];
  if (activeSection === 'home') {
    mockPosts = activeFeed === 'yourFeed' ? [
      { title: 'Q&A: Admissions Advice for New Applicants', author: 'StaffMember123', content: 'Ask your questions about the admissions process at ABC Community.' },
      { title: 'Top Scholarship Opportunities This Month', author: 'ScholarBot', content: 'Check out these new scholarship listings available nationwide.' },
      { title: 'New Poll: Which Campus Club Should We Feature?', author: 'StudentRep', content: 'Vote on which student club you want highlighted in next week’s webinar.' }
    ] : [
      { title: 'Explore: Upcoming Tech Webinars', author: 'TechGuru', content: 'Join us for a series of webinars on the latest in technology.' },
      { title: 'Discover: Study Abroad Programs', author: 'TravelAdvisor', content: 'Find out about exciting study abroad opportunities around the world.' },
      { title: 'Trending: Eco-Friendly Scholarships', author: 'GreenScholar', content: 'Learn about scholarships for students committed to environmental sustainability.' }
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

  // Render based on active section
  return (
    <main className="feed">
      <h2>
        {activeSection === 'home' ? (activeFeed === 'yourFeed' ? 'Your Feed' : 'Explore') 
          : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
      </h2>
      {activeSection === 'info' ? (
        isLoadingForums ? (
          <p>Loading forums...</p>
        ) : forums.length === 0 ? (
          <p>No forums available.</p>
        ) : (
          <div className="forum-list">
            {forums.map((forum) => (
              <Link 
                to={`/info/forum/${forum.forum_id}`} 
                key={forum.forum_id} 
                className="forum-card"
                style={{ textDecoration: 'none', color: 'inherit' }}  // optional styling
              >
                <h3 className="forum-title">{forum.name}</h3>
                <p className="forum-description">{forum.description}</p>
              </Link>
            ))}
          </div>
        )
      ) : (
        <p>Select a section to display relevant content.</p>
      )}
      {activeSection === 'communities' ? (
        <>
          {/* Followed Communities Section */}
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

          {/* Search Bar for Communities */}
          <div className="search-bar-container">
            <input
              type="text"
              placeholder="Search communities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="community-search-bar"
            />
          </div>

          {/* All Communities (Paginated) */}
          <div className="communities-section">
            <h3>All Universities</h3>
            {isLoadingAll ? (
              <p>Loading all universities...</p>
            ) : allCommunities.length === 0 ? (
              <p>No universities found.</p>
            ) : (
              <div className="community-grid">
                {allCommunities
                  .filter(community => !followedIds.has(community.community_id)) // Exclude followed communities
                  .map((community) => (
                    <div key={community.community_id} className="community-card">
                      <img
                        src={community.logo_path || '/uploads/logos/default-logo.png'}
                        alt={`${community.name} Logo`}
                        className="community-logo"
                      />
                      <h4 className="community-name">{community.name}</h4>
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
            )}
            <div className="pagination-controls">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="pagination-button">
                Previous
              </button>
              <span className="pagination-info">Page {currentPage} of {totalPages}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="pagination-button">
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        mockPosts.map((post, index) => (
          <div key={index} className="post-card">
            <h3>{post.title}</h3>
            <small>Posted by {post.author}</small>
            <p>{post.content}</p>
          </div>
        ))
      )}
    </main>
  );
}

function RightSidebar() {
  return (
    <aside className="right-sidebar">
      <h3>Suggested Connections</h3>
      <ul>
        <li>@JohnDoe - Admissions Rep</li>
        <li>@JaneSmith - Scholarship Guru</li>
        <li>@CampusLife - Student Events</li>
      </ul>
    </aside>
  );
}

export default App;
