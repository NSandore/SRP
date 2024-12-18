import React, { useState, useEffect } from 'react';
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
import SignUp from './components/SignUp';
import InterestSelection from './components/InterestSelection';
import Login from './components/Login';
import { RiMedalFill } from 'react-icons/ri';

function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');

  // State for active section in the sidebar
  const [activeSection, setActiveSection] = useState('home');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://34.31.85.242/api/check_session.php', { withCredentials: true });
        console.log("Check session response:", response.data);
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
              isCollapsed={isSidebarCollapsed} 
              setIsSidebarCollapsed={setIsSidebarCollapsed}
              activeSection={activeSection}
              setActiveSection={setActiveSection} 
              setActiveFeed={setActiveFeed}
            />
            <Feed 
              activeFeed={activeFeed} 
              activeSection={activeSection} 
              userData={userData} 
            />
            <RightSidebar />
          </div>
        </>
      )}
    </div>
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
          <div className="account-settings" onClick={() => setAccountMenuVisible(!accountMenuVisible)}>
            <FaUserCircle className="nav-icon" title="Account Settings" />
            {accountMenuVisible && userData && (
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
        </div>
        {!userData && (
          <button className="nav-button" onClick={() => setStep(2)}>Login</button>
        )}
      </div>
    </nav>
  );
}

function LeftSidebar({ isSidebarCollapsed, setIsSidebarCollapsed, activeSection, setActiveSection, setActiveFeed }) {
  const handleSectionClick = (section) => {
    setActiveSection(section);
    if (section === 'home') {
      setActiveFeed('yourFeed');
    }
  };

  return (
    <aside className={`left-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <ul className="sidebar-list">
        <li className="sidebar-toggle-container">
          <button
            className="sidebar-toggle-button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <FaBars /> : <FaTimes />}
          </button>
        </li>
        <li 
          className={`sidebar-item ${activeSection === 'home' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('home')}
        >
          <TbWriting className="sidebar-icon" /> 
          <span className="sidebar-text">Home</span>
        </li>
        <li 
          className={`sidebar-item ${activeSection === 'saved' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('saved')}
        >
          <FaBookmark className="sidebar-icon" /> 
          <span className="sidebar-text">Saved</span>
        </li>
        <li 
          className={`sidebar-item ${activeSection === 'friends' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('friends')}
        >
          <FaUsers className="sidebar-icon" /> 
          <span className="sidebar-text">Friends</span>
        </li>

        <li 
          className={`sidebar-item ${activeSection === 'groups' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('groups')}
        >
          <FaPeopleCarry className="sidebar-icon" /> 
          <span className="sidebar-text">Groups</span>
        </li>
        <li 
          className={`sidebar-item ${activeSection === 'scholarships' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('scholarships')}
        >
          <RiMedalFill className="sidebar-icon" /> 
          <span className="sidebar-text">Scholarships</span>
        </li>
        <li 
          className={`sidebar-item ${activeSection === 'universities' ? 'active' : ''}`} 
          onClick={() => handleSectionClick('universities')}
        >
          <FaUniversity className="sidebar-icon" /> 
          <span className="sidebar-text">Universities</span>
        </li>
      </ul>
    </aside>
  );
}

function Feed({ activeFeed, activeSection, userData }) {
  const [followedUniversities, setFollowedUniversities] = useState([]);
  const [allUniversities, setAllUniversities] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // Fetch followed universities (universities the user follows)
  const fetchFollowedUniversities = async () => {
    if (!userData) return;
    setIsLoadingFollowed(true);
    try {
      console.log("Fetching followed universities...");
      const response = await axios.get(`/api/followed_universities.php?user_id=${userData.user_id}`);
      console.log("Followed Universities Response:", response.data);
      if (Array.isArray(response.data)) {
        setFollowedUniversities(response.data);
      } else {
        setFollowedUniversities([]);
      }
    } catch (error) {
      console.error('Error fetching followed universities:', error);
      setFollowedUniversities([]);
    } finally {
      setIsLoadingFollowed(false);
    }
  };

  // Fetch all universities (paginated and searchable)
  const fetchAllUniversities = async (page = 1, term = '') => {
    if (!userData) {
      console.error('User data is not available.');
      return;
    }
    setIsLoadingAll(true);
    try {
      console.log(`Fetching all universities... page: ${page}, term: "${term}"`);
      const response = await axios.get(`/api/fetch_all_university_data.php?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`);
      console.log("All Universities Response:", response.data);
      
      // Assuming the backend returns pagination info
      if (response.data.universities) {
        setAllUniversities(response.data.universities);
        setTotalPages(response.data.total_pages || 1);
      } else {
        // If the backend only returns an array without pagination
        setAllUniversities(response.data);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching all universities:', error);
      setAllUniversities([]);
      setTotalPages(1);
    } finally {
      setIsLoadingAll(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'universities' && userData) {
      console.log("Universities section active and userData available. Fetching data...");
      fetchFollowedUniversities();
      fetchAllUniversities(1, '');
      setCurrentPage(1);
      setSearchTerm('');
    }
  }, [activeSection, userData]); // Trigger only when section changes to universities and userData is set

  // Handle search changes with debouncing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (activeSection === 'universities') {
        fetchAllUniversities(1, searchTerm);
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
      fetchAllUniversities(newPage, searchTerm);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchAllUniversities(newPage, searchTerm);
    }
  };

  // Implement Follow/Unfollow Functionality
  const handleFollowToggle = async (universityId, isFollowed) => {
    try {
      if (isFollowed) {
        // Unfollow the university
        await axios.post('/api/unfollow_university.php', { user_id: userData.user_id, university_id: universityId });
      } else {
        // Follow the university
        await axios.post('/api/follow_university.php', { user_id: userData.user_id, university_id: universityId });
      }
      // Refresh both followed and all universities lists
      fetchFollowedUniversities();
      fetchAllUniversities(currentPage, searchTerm);
    } catch (error) {
      console.error('Error toggling follow status:', error);
      alert('An error occurred while updating follow status.');
    }
  };

  // For non-universities sections
  let mockPosts = [];
  if (activeSection === 'home') {
    mockPosts = activeFeed === 'yourFeed' ? [
      { title: 'Q&A: Admissions Advice for New Applicants', author: 'StaffMember123', content: 'Ask your questions about the admissions process at ABC University.' },
      { title: 'Top Scholarship Opportunities This Month', author: 'ScholarBot', content: 'Check out these new scholarship listings available nationwide.' },
      { title: 'New Poll: Which Campus Club Should We Feature?', author: 'StudentRep', content: 'Vote on which student club you want highlighted in next week’s webinar.' }
    ] : [
      { title: 'Explore: Upcoming Tech Webinars', author: 'TechGuru', content: 'Join us for a series of webinars on the latest in technology.' },
      { title: 'Discover: Study Abroad Programs', author: 'TravelAdvisor', content: 'Find out about exciting study abroad opportunities around the world.' },
      { title: 'Trending: Eco-Friendly Scholarships', author: 'GreenScholar', content: 'Learn about scholarships for students committed to environmental sustainability.' }
    ];
  } else if (activeSection === 'saved') {
    mockPosts = [{ title: 'Your Saved Posts', author: 'You', content: 'Here are your saved posts...' }];
  } else if (activeSection === 'friends') {
    mockPosts = [{ title: 'Friends Updates', author: 'FriendBot', content: 'Your friends are up to...' }];
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
      {activeSection === 'universities' ? (
        <>
          {/* Followed Universities Section */}
          <div className="universities-section">
            <h3>Your Followed Universities</h3>
            {isLoadingFollowed ? (
              <p>Loading followed universities...</p>
            ) : followedUniversities.length === 0 ? (
              <p>You are not following any universities yet.</p>
            ) : (
              <div className="university-grid">
                {followedUniversities.map((school) => (
                  <div key={school.university_id} className="university-card">
                    <img
                      src={school.logo_path || '/uploads/logos/default-logo.png'}
                      alt={`${school.name} Logo`}
                      className="university-logo"
                    />
                    <h4 className="university-name">{school.name}</h4>
                    <p className="university-location">{school.location}</p>
                    {school.tagline && <p className="university-tagline">{school.tagline}</p>}
                    <p className="followers-count">{school.followers_count} Followers</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Bar for Universities */}
          <div className="search-bar-container">
            <input
              type="text"
              placeholder="Search universities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="university-search-bar"
            />
          </div>

          {/* All Universities (Paginated) */}
          <div className="universities-section">
            <h3>All Universities</h3>
            {isLoadingAll ? (
              <p>Loading all universities...</p>
            ) : allUniversities.length === 0 ? (
              <p>No universities found.</p>
            ) : (
              <div className="university-grid">
                {allUniversities.map((uni) => (
                  <div key={uni.university_id} className={`university-card ${uni.is_followed ? 'followed' : ''}`}>
                    <img
                      src={uni.logo_path || '/uploads/logos/default-logo.png'}
                      alt={`${uni.name} Logo`}
                      className="university-logo"
                    />
                    <h4 className="university-name">{uni.name}</h4>
                    <p className="university-location">{uni.location}</p>
                    {uni.tagline && <p className="university-tagline">{uni.tagline}</p>}
                    <p className="followers-count">{uni.followers_count} Followers</p>
                    <button 
                      className={`follow-button ${uni.is_followed ? 'unfollow' : 'follow'}`}
                      onClick={() => handleFollowToggle(uni.university_id, uni.is_followed)}
                    >
                      {uni.is_followed ? 'Unfollow' : 'Follow'}
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
