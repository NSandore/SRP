// src/pages/Home.js
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);

  // State Variables
  const [featuredScholarships, setFeaturedScholarships] = useState([]);
  const [popularPosts, setPopularPosts] = useState([]);
  const [followedSchools, setFollowedSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data Fetching with useEffect
  useEffect(() => {
    Promise.all([
      api.get('/scholarships/featured'),
      api.get('/forums/popular'),
      user ? api.get('/users/followed-schools') : Promise.resolve({ data: [] }),
    ])
      .then(([scholarshipsResponse, forumsResponse, schoolsResponse]) => {
        setFeaturedScholarships(scholarshipsResponse.data);
        setPopularPosts(forumsResponse.data);
        if (user) {
          setFollowedSchools(schoolsResponse.data);
        }
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setError('Failed to load data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  // Conditional Rendering for Loading and Error States
  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="home">
      {/* Static Content */}
      <h1>Welcome to Your Platform Name</h1>
      <p>Your gateway to resources, community, and opportunities.</p>

      {/* Navigation Links */}
      <nav>
        <ul>
          <li><Link to="/resources">Resources</Link></li>
          <li><Link to="/forums">Forums</Link></li>
          <li><Link to="/polls">Polls</Link></li>
          <li><Link to="/webinars">Webinars</Link></li>
          <li><Link to="/profile">Profile</Link></li>
        </ul>
      </nav>

      {/* Featured Scholarships */}
      <section>
        <h2>Featured Scholarships</h2>
        {featuredScholarships.length > 0 ? (
          <ul>
            {featuredScholarships.map((scholarship) => (
              <li key={scholarship.id}>
                <Link to={`/scholarships/${scholarship.id}`}>{scholarship.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No featured scholarships at the moment.</p>
        )}
      </section>

      {/* Popular Forum Posts */}
      <section>
        <h2>Popular Forum Posts</h2>
        {popularPosts.length > 0 ? (
          <ul>
            {popularPosts.map((post) => (
              <li key={post.id}>
                <Link to={`/forums/posts/${post.id}`}>{post.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No popular posts at the moment.</p>
        )}
      </section>

      {/* Personalized Content for Authenticated Users */}
      {user && (
        <section>
          <h2>Your Followed Schools</h2>
          {followedSchools.length > 0 ? (
            <ul>
              {followedSchools.map((school) => (
                <li key={school.id}>
                  <Link to={`/schools/${school.id}`}>{school.name}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>You are not following any schools yet.</p>
          )}
        </section>
      )}
    </div>
  );
};

export default Home;
