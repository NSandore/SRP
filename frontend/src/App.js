import React from 'react';
import './App.css'; // Import the external CSS stylesheet

function App() {
  return (
    <div className="app-container">
      <NavBar />
      <div className="main-content">
        <LeftSidebar />
        <Feed />
        <RightSidebar />
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <h2 className="brand-title">MyEduPlatform</h2>
      </div>
      <div className="nav-center">
        <input
          type="text"
          placeholder="Search resources, forums..."
          className="search-input"
        />
      </div>
      <div className="nav-right">
        <button className="nav-button">Login</button>
        <button className="nav-button">Sign Up</button>
      </div>
    </nav>
  );
}

function LeftSidebar() {
  return (
    <aside className="left-sidebar">
      <h3 className="sidebar-title">Resources</h3>
      <ul className="sidebar-list">
        <li>Scholarships</li>
        <li>University Guides</li>
        <li>Study Materials</li>
        <li>Forums</li>
        <li>Webinars</li>
      </ul>
      <h3 className="sidebar-title">Your Communities</h3>
      <ul className="sidebar-list">
        <li>Harvard University</li>
        <li>MIT</li>
        <li>Stanford Discussions</li>
      </ul>
    </aside>
  );
}

function Feed() {
  const mockPosts = [
    {
      title: 'Q&A: Admissions Advice for New Applicants',
      author: 'StaffMember123',
      content: 'Ask your questions about the admissions process at ABC University.'
    },
    {
      title: 'Top Scholarship Opportunities This Month',
      author: 'ScholarBot',
      content: 'Check out these new scholarship listings available nationwide.'
    },
    {
      title: 'New Poll: Which Campus Club Should We Feature?',
      author: 'StudentRep',
      content: 'Vote on which student club you want highlighted in next week’s webinar.'
    }
  ];

  return (
    <main className="feed">
      <h2>Your Feed</h2>
      {mockPosts.map((post, index) => (
        <div key={index} className="post-card">
          <h3>{post.title}</h3>
          <small>Posted by {post.author}</small>
          <p>{post.content}</p>
          <div className="post-actions">
            <button className="action-button">Like</button>
            <button className="action-button">Comment</button>
            <button className="action-button">Share</button>
          </div>
        </div>
      ))}
    </main>
  );
}

function RightSidebar() {
  return (
    <aside className="right-sidebar">
      <h3 className="sidebar-title">Suggested Connections</h3>
      <ul className="sidebar-list">
        <li>@JohnDoe - Admissions Rep</li>
        <li>@JaneSmith - Scholarship Guru</li>
        <li>@CampusLife - Student Events</li>
      </ul>
      <h3 className="sidebar-title">Trending Topics</h3>
      <ul className="sidebar-list">
        <li>#FinancialAid</li>
        <li>#Housing</li>
        <li>#CourseRecommendations</li>
      </ul>
    </aside>
  );
}

export default App;
