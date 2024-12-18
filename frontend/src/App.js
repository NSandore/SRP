import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import {
  FaThumbsUp, FaComment, FaShare, FaBars, FaTimes,
  FaEnvelope, FaBell, FaUserCircle, FaBookmark, FaUniversity
} from 'react-icons/fa';
import { FaUserGroup, FaPeopleGroup } from "react-icons/fa6";
import { TbWriting } from "react-icons/tb";
import SignUp from './components/SignUp';
import InterestSelection from './components/InterestSelection';
import Login from './components/Login';
import { RiMedalFill } from "react-icons/ri";

function App() {
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [activeFeed, setActiveFeed] = useState('yourFeed');
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
            userData={userData} 
            accountMenuVisible={accountMenuVisible}
            setAccountMenuVisible={setAccountMenuVisible}
            handleLogout={handleLogout}
          />
          <div className="main-content">
            <LeftSidebar 
              isCollapsed={isSidebarCollapsed} 
              setIsSidebarCollapsed={setIsSidebarCollapsed} 
            />
            <Feed activeFeed={activeFeed} />
            <RightSidebar />
          </div>
        </>
      )}
    </div>
  );
}

function NavBar({ setStep, activeFeed, setActiveFeed, userData, accountMenuVisible, setAccountMenuVisible, handleLogout }) {
  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <h2 className="brand-title">StudentSphere</h2>
      </div>
      <div className="nav-center">
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
      </div>
      <div className="nav-right">
        <div className="nav-icons">
          <FaEnvelope className="nav-icon" title="Messages" />
          <FaBell className="nav-icon" title="Notifications" />
          <div className="account-settings" onClick={() => setAccountMenuVisible(!accountMenuVisible)}>
            <FaUserCircle className="nav-icon" title="Account Settings" />
            {accountMenuVisible && userData && (
              <div className="account-menu">
                <button onClick={handleLogout}>Log Out</button>
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

function LeftSidebar({ isCollapsed, setIsSidebarCollapsed }) {
  return (
    <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <ul className="sidebar-list">
        <li className="sidebar-toggle-container">
          <button
            className="sidebar-toggle-button"
            onClick={() => setIsSidebarCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <FaBars /> : <FaTimes />}
          </button>
        </li>
        <li><FaThumbsUp className="sidebar-icon" /> <span className="sidebar-text">Saved</span></li>
        <li><FaComment className="sidebar-icon" /> <span className="sidebar-text">Friends</span></li>
        <li><FaShare className="sidebar-icon" /> <span className="sidebar-text">Groups</span></li>
        <li><FaEnvelope className="sidebar-icon" /> <span className="sidebar-text">Scholarships</span></li>
        <li><FaBell className="sidebar-icon" /> <span className="sidebar-text">Pages</span></li>
        <li><FaUserCircle className="sidebar-icon" /> <span className="sidebar-text">Universities</span></li>
      </ul>
    </aside>
  );
}

function Feed({ activeFeed }) {
  const mockPosts = activeFeed === 'yourFeed' ? [
    { title: 'Q&A: Admissions Advice for New Applicants', author: 'StaffMember123', content: 'Ask your questions about the admissions process at ABC University.' },
    { title: 'Top Scholarship Opportunities This Month', author: 'ScholarBot', content: 'Check out these new scholarship listings available nationwide.' },
    { title: 'New Poll: Which Campus Club Should We Feature?', author: 'StudentRep', content: 'Vote on which student club you want highlighted in next week’s webinar.' }
  ] : [
    { title: 'Explore: Upcoming Tech Webinars', author: 'TechGuru', content: 'Join us for a series of webinars on the latest in technology.' },
    { title: 'Discover: Study Abroad Programs', author: 'TravelAdvisor', content: 'Find out about exciting study abroad opportunities around the world.' },
    { title: 'Trending: Eco-Friendly Scholarships', author: 'GreenScholar', content: 'Learn about scholarships for students committed to environmental sustainability.' }
  ];

  return (
    <main className="feed">
      <h2>{activeFeed === 'yourFeed' ? 'Your Feed' : 'Explore'}</h2>
      {mockPosts.map((post, index) => (
        <div key={index} className="post-card">
          <h3>{post.title}</h3>
          <small>Posted by {post.author}</small>
          <p>{post.content}</p>
        </div>
      ))}
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
