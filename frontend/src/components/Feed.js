// src/components/Feed.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify'; 
import {
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';

import ForumCard from './ForumCard'; // Adjust path if ForumCard is located elsewhere
import CommunityRequestModal from './CommunityRequestModal';

function Feed({ activeFeed, setActiveFeed, activeSection, userData }) {
  const [sortBy, setSortBy] = useState("default"); // options: "default", "popularity", "mostUpvoted", "mostRecent"
  const [communityFilter, setCommunityFilter] = useState('All'); // Options: "All", "Followed", "Unfollowed"
  const [selectedCommunityTab, setSelectedCommunityTab] = useState("university");

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

  // Community creation request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({
    name: '',
    type: '',
    description: '',
    tagline: '',
    location: '',
    website: '',
    primary_color: '',
    secondary_color: ''
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // ============== S A V E D ==============
  // We’ll store arrays for savedForums, savedThreads, savedPosts
  const [savedForums, setSavedForums] = useState([]);
  const [savedThreads, setSavedThreads] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  // Track which saved tab is active
  const [savedTab, setSavedTab] = useState('forums'); // 'forums' | 'threads' | 'posts'

  const [feedThreads, setFeedThreads] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  useEffect(() => {
    console.log("Active Section:", activeSection);
  }, [activeSection]);

  // ------------- THREAD VOTING -------------
  const handleThreadVoteClick = async (threadId, voteType) => {
    if (!userData) {
      alert("You must be logged in to vote.");
      return;
    }
    try {
      const response = await axios.post(
        "/api/vote_thread.php",
        {
          thread_id: threadId,
          user_id: userData.user_id,
          vote_type: voteType,
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        // Refresh feed threads after voting
        fetchFeedThreads();
      } else {
        alert(response.data.error || "An error occurred.");
      }
    } catch (error) {
      console.error("Error voting on thread:", error);
      alert("An error occurred while voting on thread.");
    }
  };

  const handleThreadUpvoteClick = (threadId) => handleThreadVoteClick(threadId, "up");
  const handleThreadDownvoteClick = (threadId) => handleThreadVoteClick(threadId, "down");

  // Fetch the user's personalized feed (threads)
  const fetchFeedThreads = () => {
    if (activeSection === "home" && activeFeed === "yourFeed" && userData) {
      setIsLoadingFeed(true);
      axios
        .get(`/api/fetch_feed.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        })
        .then((response) => {
          if (response.data.success) {
            setFeedThreads(response.data.threads);
          } else {
            console.error("Error fetching feed:", response.data.error);
          }
        })
        .catch((error) => {
          console.error("Error fetching feed:", error);
        })
        .finally(() => {
          setIsLoadingFeed(false);
        });
    }
  };

  // ------------- SAVED ITEMS -------------
  const fetchSavedForums = async () => {
    if (!userData) return;
    try {
      const resp = await axios.get(
        `/api/fetch_saved_forums.php?user_id=${userData.user_id}`,
        { withCredentials: true }
      );
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
      const resp = await axios.get(
        `/api/fetch_saved_threads.php?user_id=${userData.user_id}`,
        { withCredentials: true }
      );
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
      const resp = await axios.get(
        `/api/fetch_saved_posts.php?user_id=${userData.user_id}`,
        { withCredentials: true }
      );
      if (resp.data.success) {
        setSavedPosts(resp.data.saved_posts || []);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    }
  };

  // Toggle the 3-dot menu on a forum
  const toggleMenu = (forumId) => {
    setOpenMenuId(openMenuId === forumId ? null : forumId);
  };

  // Save/Unsave a Forum
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
        // Re-fetch saved forums so the UI updates
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

  // ------------- COMMUNITIES -------------
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

  const fetchAllCommunitiesData = async (page = 1, term = '') => {
    if (!userData) return;
    setIsLoadingAll(true);
    try {
      // Decide the endpoint by selectedCommunityTab
      const endpoint =
        selectedCommunityTab === "university"
          ? "/api/fetch_all_university_data.php"
          : "/api/fetch_all_group_data.php";
      const response = await axios.get(
        `${endpoint}?user_id=${userData.user_id}&page=${page}&search=${encodeURIComponent(term)}`
      );
      const communities = response.data.communities;
      setAllCommunities(Array.isArray(communities) ? communities : []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching all communities:', error);
      setAllCommunities([]);
      setTotalPages(1);
    } finally {
      setIsLoadingAll(false);
    }
  };

  // ------------- FORUMS -------------
  const fetchForums = async (communityId) => {
    if (!userData) {
      setIsLoadingForums(false);
      return;
    }
    setIsLoadingForums(true);
    try {
      const resp = await axios.get(
        `/api/fetch_forums.php?community_id=${communityId}&user_id=${userData.user_id}`
      );
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

  // Sorting helper for forums
  const sortItems = (items, criteria) => {
    const sorted = [...items];
    if (criteria === "popularity") {
      // Sort by total votes, descending
      sorted.sort((a, b) =>
        (parseInt(b.upvotes, 10) + parseInt(b.downvotes, 10)) -
        (parseInt(a.upvotes, 10) + parseInt(a.downvotes, 10))
      );
    } else if (criteria === "mostUpvoted") {
      // Sort by upvotes only
      sorted.sort((a, b) => parseInt(b.upvotes, 10) - parseInt(a.upvotes, 10)).reverse();
    } else if (criteria === "mostRecent") {
      // Sort by created_at descending
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return sorted;
  };

  const sortedForums = sortBy === "default" ? forums : sortItems(forums, sortBy);

  // Forum upvote/downvote
  const handleVoteClick = async (forumId, voteType) => {
    if (!userData) {
      alert("You must be logged in to vote.");
      return;
    }
    try {
      const response = await axios.post(
        "/api/vote_forum.php",
        {
          forum_id: forumId,
          user_id: userData.user_id,
          vote_type: voteType
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        // Refresh the "info" section’s forums (example: community_id=3)
        fetchForums(3);
      } else {
        alert(response.data.error || "An error occurred.");
      }
    } catch (error) {
      console.error("Error voting:", error);
      alert("An error occurred while voting.");
    }
  };

  const handleUpvoteClick = (forumId) => handleVoteClick(forumId, "up");
  const handleDownvoteClick = (forumId) => handleVoteClick(forumId, "down");

  // ------------- INITIAL HOOKS -------------
  // When the user goes to "communities"
  useEffect(() => {
    if (activeSection === 'communities' && userData) {
      fetchFollowedCommunities();
      fetchAllCommunitiesData(1, '');
      setCurrentPage(1);
      setSearchTerm('');
    }
    if (activeSection === 'info') {
      // Example: fetch forums for community_id=3
      fetchForums(3);
      // Also fetch saved forums so we know what's saved
      fetchSavedForums();
    }
    if (activeSection === 'saved' && userData) {
      fetchSavedForums();
      fetchSavedThreads();
      fetchSavedPosts();
      setSavedTab('forums');
    }
  }, [activeSection, userData, selectedCommunityTab]);

  // Searching communities (debounce approach)
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunitiesData(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, activeSection, selectedCommunityTab]);

  // Pagination controls
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchAllCommunitiesData(newPage, searchTerm);
    }
  };
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchAllCommunitiesData(newPage, searchTerm);
    }
  };

  // Follow/unfollow community
  const handleFollowToggle = async (communityId, isFollowed) => {
    if (!userData) return;
    try {
      const endpoint = isFollowed ? '/api/unfollow_community.php' : '/api/follow_community.php';
      await axios.post(endpoint, {
        user_id: userData.user_id,
        community_id: communityId
      });
      fetchFollowedCommunities();
      fetchAllCommunitiesData(currentPage, searchTerm);
    } catch (error) {
      console.error('Error toggling follow status:', error);
      alert('An error occurred while updating follow status.');
    }
  };

  // ------------- CREATE FORUM -------------
  const handleCreateForumSubmit = async (e) => {
    e.preventDefault();
    setIsCreatingForum(true);
    try {
      const resp = await axios.post('/api/create_forum.php', {
        community_id: 3, // Example: "info" community
        name: newForumName,
        description: newForumDescription
      });
      if (resp.data.success) {
        setNewForumName('');
        setNewForumDescription('');
        setShowCreateForumModal(false);
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

  // ------------- EDIT FORUM -------------
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

  // ------------- DELETE FORUM -------------
  const handleDeleteForum = async (forum_id) => {
    if (!userData) {
      setNotification({ type: 'error', message: 'You must be logged in to delete a forum.' });
      return;
    }
    try {
      const resp = await axios.post('/api/delete_forum.php', { forum_id });
      if (resp.data.success) {
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

  // ------------- COMMUNITY REQUEST -------------
  const handleCommunityRequestSubmit = async (e) => {
    e.preventDefault();
    if (!userData) return;
    setIsSubmittingRequest(true);
    try {
      const resp = await axios.post('/api/request_community.php', requestData, { withCredentials: true });
      if (resp.data.success) {
        setRequestData({
          name: '',
          type: '',
          description: '',
          tagline: '',
          location: '',
          website: '',
          primary_color: '',
          secondary_color: ''
        });
        setShowRequestModal(false);
        setNotification({ type: 'success', message: 'Request submitted.' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Error submitting request.' });
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      setNotification({ type: 'error', message: 'An error occurred.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // ------------- HOME FEED -------------
  // Re-fetch feed threads if userData changes or the feed changes
  useEffect(() => {
    if (activeSection === 'home' && activeFeed === 'yourFeed' && userData) {
      setIsLoadingFeed(true);
      axios
        .get(`/api/fetch_feed.php?user_id=${userData.user_id}`, { withCredentials: true })
        .then(response => {
          if (response.data.success) {
            setFeedThreads(response.data.threads);
          } else {
            console.error("Error fetching feed:", response.data.error);
          }
        })
        .catch(error => {
          console.error("Error fetching feed:", error);
        })
        .finally(() => {
          setIsLoadingFeed(false);
        });
    }
  }, [activeSection, activeFeed, userData]);  

  // We have "mockPosts" concept in the original code to display fallback content
  let mockPosts = [];

  // Create a set for quick lookup of followed community IDs
  const followedIds = new Set(followedCommunities.map((c) => c.community_id));

  // Filter communities by type (tab) and filter (All, Followed, Unfollowed)
  const filteredCommunities = allCommunities.filter((community) => {
    // Must match the selected tab type
    if (community.community_type !== selectedCommunityTab) return false;

    // Then apply filter
    if (communityFilter === 'Followed') {
      return followedIds.has(community.community_id);
    } else if (communityFilter === 'Unfollowed') {
      return !followedIds.has(community.community_id);
    }
    return true;
  });

  // ------------- RENDER LOGIC -------------
  // HOME SECTION
  if (activeSection === 'home') {
    return (
      <main>
        <div className="feed-container">
          <div className="feed-header">
            <h2>{activeFeed === 'yourFeed' ? 'Your Feed' : 'Explore'}</h2>
            <div className="feed-toggle-buttons">
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

          {activeFeed === 'yourFeed' ? (
            isLoadingFeed ? (
              <p>Loading feed...</p>
            ) : feedThreads.length === 0 ? (
              <p>No threads in your feed.</p>
            ) : (
              feedThreads.map((thread) => (
                <div
                  key={thread.thread_id}
                  className="feed-thread-card"
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    border: "1px solid",
                    //borderColor: "blue",
                    borderRadius: "8px",
                  }}
                >
                  <div className="thread-header">
                    <Link
                      to={`/info/forum/${thread.forum_id}/thread/${thread.thread_id}`}
                      className="thread-link"
                    >
                      <small className="thread-community">
                        <Link
                          to={`/${thread.community_type}/${thread.community_id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          {thread.community_name}
                        </Link>
                      </small>
                      <h3 className="thread-title">{thread.title}</h3>
                      <small>
                        Posted by{" "}
                        <Link
                          to={`/user/${thread.user_id}`}
                          style={{ textDecoration: "none" }}
                        >
                          {thread.first_name}{" "}
                          {thread.last_name ? thread.last_name.charAt(0) + "." : ""}
                        </Link>{" "}
                        on {new Date(thread.created_at).toLocaleString()}
                      </small>
                    </Link>
                  </div>
                  <div className="vote-row">
                    <button
                      type="button"
                      className="vote-button upvote-button"
                      title="Upvote"
                      onClick={() => handleThreadUpvoteClick(thread.thread_id)}
                    >
                      {thread.user_vote === "up" ? (
                        <FaArrowAltCircleUp style={{ color: "green" }} />
                      ) : (
                        <FaRegArrowAltCircleUp style={{ color: "gray" }} />
                      )}
                    </button>
                    <span className="vote-count">{thread.upvotes}</span>
                    <button
                      type="button"
                      className="vote-button downvote-button"
                      title="Downvote"
                      onClick={() => handleThreadDownvoteClick(thread.thread_id)}
                    >
                      {thread.user_vote === "down" ? (
                        <FaArrowAltCircleDown style={{ color: "red" }} />
                      ) : (
                        <FaRegArrowAltCircleDown style={{ color: "gray" }} />
                      )}
                    </button>
                    <span className="vote-count">{thread.downvotes}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            // DUMMY Explore content
            <div className="explore-dummy">
              <p>This is some dummy explore content!</p>
              {/* Additional dummy content here */}
            </div>
          )}
        </div>
      </main>
    );
  }

  // COMMUNITIES SECTION
  if (activeSection === 'communities') {
    return (
      <main>
        <div className="feed-container">
          <div
            className="communities-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #ddd',
              marginBottom: '1rem'
            }}
          >
            <h2>Communities</h2>
            <div className="feed-toggle-buttons">
              <button
                className={`feed-option-button ${communityFilter === 'All' ? 'active' : ''}`}
                onClick={() => setCommunityFilter('All')}
              >
                All
              </button>
              <button
                className={`feed-option-button ${communityFilter === 'Followed' ? 'active' : ''}`}
                onClick={() => setCommunityFilter('Followed')}
              >
                Followed
              </button>
              <button
                className={`feed-option-button ${communityFilter === 'Unfollowed' ? 'active' : ''}`}
                onClick={() => setCommunityFilter('Unfollowed')}
              >
                Unfollowed
              </button>
            </div>
          </div>

          {/* Community Type Tabs */}
          <div
            className="community-tab"
            style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <button
                onClick={() => setSelectedCommunityTab("university")}
                className={selectedCommunityTab === "university" ? "active" : ""}
              >
                Universities
              </button>
              <button
                onClick={() => setSelectedCommunityTab("group")}
                className={selectedCommunityTab === "group" ? "active" : ""}
              >
                Groups
              </button>
            </div>
            <button className="non-togglable-button" onClick={() => setShowRequestModal(true)}>
              Request New
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-bar-container">
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
            {isLoadingAll ? (
              <p>Loading communities...</p>
            ) : filteredCommunities.length > 0 ? (
              <div className="community-grid">
                {filteredCommunities.map((community) => (
                  <div
                    key={community.community_id}
                    className="community-card"
                    style={
                      communityFilter === 'All' && followedIds.has(community.community_id)
                        ? { border: '2px solid green' }
                        : {}
                    }
                  >
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
                    {community.tagline && (
                      <p className="community-tagline">{community.tagline}</p>
                    )}
                    <p className="followers-count">
                      {community.followers_count} Followers
                    </p>
                    <button
                      className={`follow-button ${
                        followedIds.has(community.community_id) ? 'unfollow' : 'follow'
                      }`}
                      onClick={() =>
                        handleFollowToggle(community.community_id, followedIds.has(community.community_id))
                      }
                    >
                      {followedIds.has(community.community_id) ? 'Unfollow' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>No {selectedCommunityTab === "university" ? "universities" : "groups"} found.</p>
            )}

            {/* Pagination */}
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
        </div>
        {showRequestModal && (
          <CommunityRequestModal
            isVisible={showRequestModal}
            onClose={() => setShowRequestModal(false)}
            onSubmit={handleCommunityRequestSubmit}
            formData={requestData}
            setFormData={setRequestData}
            isSubmitting={isSubmittingRequest}
          />
        )}
      </main>
    );
  }

  // INFO SECTION
  if (activeSection === 'info') {
    return (
      <main>
        <div className="feed-container">
          <div
            className="feed-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h2>General Information</h2>
            {/* Admin "Create Forum" button (role_id === 7 is your example for admin) */}
            {userData?.role_id === 7 && (
              <button
                className="non-togglable-button"
                onClick={() => setShowCreateForumModal(true)}
              >
                + New Forum
              </button>
            )}
          </div>

          {/* CREATE FORUM MODAL */}
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

          {/* EDIT FORUM MODAL */}
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
                    <button type="button" onClick={cancelEditingForum}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Sorting Dropdown */}
          <div className="sort-container" style={{ marginBottom: '1rem' }}>
            <label htmlFor="sort-by">Sort by: </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="popularity">Popularity</option>
              <option value="mostUpvoted">Most Upvoted</option>
              <option value="mostRecent">Most Recent</option>
            </select>
          </div>

          <h2 className="forum-title">Forums</h2>
          {isLoadingForums ? (
            <p>Loading forums...</p>
          ) : forums.length === 0 ? (
            <p>No forums available.</p>
          ) : (
            <div className="forum-list">
              {sortedForums.map((forum) => (
                <ForumCard
                  key={forum.forum_id}
                  forum={forum}
                  userData={userData}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  toggleMenu={toggleMenu}
                  handleSaveForum={handleSaveForum}
                  handleDeleteForum={handleDeleteForum}
                  handleUpvoteClick={handleUpvoteClick}
                  handleDownvoteClick={handleDownvoteClick}
                  startEditingForum={startEditingForum}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // FUNDING SECTION
  if (activeSection === 'funding') {
    return (
      <main>
        <div className="feed-container">
          <div className="feed-header">
            <h2>Funding</h2>
          </div>
          <p>More coming soon...</p>
        </div>
      </main>
    );
  }

  // SAVED SECTION
  if (activeSection === 'saved' && userData) {
    return (
      <main>
        <div className="feed-container">
          <div
            className="feed-header"
            style={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2>Saved</h2>
            <div className="feed-toggle-buttons">
              <button
                className={`feed-option-button ${savedTab === 'forums' ? 'active' : ''}`}
                onClick={() => setSavedTab('forums')}
              >
                Forums
              </button>
              <button
                className={`feed-option-button ${savedTab === 'threads' ? 'active' : ''}`}
                onClick={() => setSavedTab('threads')}
              >
                Threads
              </button>
              <button
                className={`feed-option-button ${savedTab === 'posts' ? 'active' : ''}`}
                onClick={() => setSavedTab('posts')}
              >
                Posts
              </button>
            </div>
          </div>

          {/* Show relevant list based on savedTab */}
          {savedTab === 'forums' && (
            <>
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
                      onClick={() => handleSaveForum(f.forum_id, true)} // 'true' => unsave
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
              {savedThreads.length === 0 ? (
                <p>You have no saved threads.</p>
              ) : (
                savedThreads.map((t) => (
                  <div key={t.thread_id} className="forum-card" style={{ marginBottom: '1rem' }}>
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
                        // Example: /api/unsave_thread.php
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
              {savedPosts.length === 0 ? (
                <p>You have no saved posts.</p>
              ) : (
                savedPosts.map((p) => (
                  <div key={p.post_id} className="forum-card" style={{ marginBottom: '1rem' }}>
                    <h4>Post #{p.post_id}</h4>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify ? DOMPurify.sanitize(p.content) : p.content
                      }}
                    />
                    <br />
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
                        // Example: /api/unsave_post.php
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
        </div>
      </main>
    );
  }

  // If none of the above sections match, display fallback content (e.g., "connections", etc.)
  return (
    <main>
      {['home', 'connections', 'funding'].includes(activeSection) &&
        activeSection !== 'info' &&
        activeSection !== 'communities' &&
        activeSection !== 'saved' &&
        mockPosts.map((post, i) => (
          <div key={i} className="post-card">
            <h3>{post.title}</h3>
            <small>Posted by {post.author}</small>
            <p>{post.content}</p>
          </div>
        ))
      }

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

export default Feed;
