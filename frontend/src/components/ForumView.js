import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ForumView({ userData }) {
  const { forum_id } = useParams();
  const [forumData, setForumData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);  // Using one loading state for simplicity

  // Fetch forum details (title, description, etc.)
  useEffect(() => {
    const fetchForumDetails = async () => {
      try {
        const response = await axios.get(`/api/fetch_forum.php?forum_id=${forum_id}`);
        setForumData(response.data);
      } catch (error) {
        console.error('Error fetching forum details:', error);
      }
    };
    fetchForumDetails();
  }, [forum_id]);

  // Fetch threads for the forum
  useEffect(() => {
    console.log('Fetching threads for forum_id:', forum_id);
    const fetchThreads = async () => {
      try {
        const response = await axios.get(`/api/fetch_threads.php?forum_id=${forum_id}`);
        console.log('Fetched thread data:', response.data);
        setThreads(response.data);
      } catch (error) {
        console.error('Error fetching threads:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchThreads();
  }, [forum_id]);

  if (isLoading) {
    return <p>Loading forums...</p>;
  }

  return (
    <div className="feed">
      {/* Back button to return to /info */}
      <Link to="/info" className="back-button">
        ← Forums
      </Link>
  
      {/* Display actual forum title */}
      <h2 className="forum-title">
        {forumData?.name ? `${forumData.name}` : `Forum ${forum_id}`}
      </h2>
  
      {threads.length === 0 ? (
        <p>No threads available.</p>
      ) : (
        <div className="forum-list">
          {threads.map((thread) => (
            <Link 
              to={`/info/forum/${forum_id}/thread/${thread.thread_id}`} 
              key={thread.thread_id} 
              className="forum-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <h3 className="forum-title">{thread.title}</h3>
              <p className="forum-description">
                Started by User {thread.user_id} on {new Date(thread.created_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );  
}

export default ForumView;
