import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ThreadView({ userData }) {
  const { thread_id } = useParams();
  const [threadData, setThreadData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // Fetch thread details using updated endpoint
  useEffect(() => {
    const fetchThread = async () => {
      try {
        const response = await axios.get(`/api/fetch_thread.php?thread_id=${thread_id}`);
        console.log('Fetched thread data:', response.data);
        setThreadData(response.data);
      } catch (error) {
        console.error('Error fetching thread details:', error);
      } finally {
        setIsLoadingThread(false);
      }
    };
    fetchThread();
  }, [thread_id]);

  // Fetch posts (replies) in the thread
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await axios.get(`/api/fetch_posts.php?thread_id=${thread_id}`);
        let postsData = response.data;
        if (!Array.isArray(postsData)) {
          postsData = [];
        }
        setPosts(postsData);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } finally {
        setIsLoadingPosts(false);
      }
    };
    fetchPosts();
  }, [thread_id]);

  if (isLoadingThread || isLoadingPosts) {
    return <p>Loading thread and posts...</p>;
  }

  return (
    <div className="feed">
      {/* Back button with forum name */}
      <Link to={`/info/forum/${threadData?.forum_id || ''}`} className="back-button">
        ← {threadData?.forum_name || 'Forum'}
      </Link>

      {/* Display thread title at the top */}
      <h2 className="forum-title">{threadData?.title || `Thread ${thread_id}`}</h2>
  
      {/* Display replies */}
      {posts.length === 0 ? (
        <p>No replies found.</p>
      ) : (
        <div className="forum-list">
          {posts.map(post => (
            <div key={post.post_id} className="forum-card">
              <p className="forum-description">{post.content}</p>
              <small>
                Posted by User {post.user_id} on {new Date(post.created_at).toLocaleString()}
              </small>
              <div>
                <span>Upvotes: {post.upvotes}</span> | <span>Downvotes: {post.downvotes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThreadView;
