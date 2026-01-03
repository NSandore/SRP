// src/components/Feed.js

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify'; 
import {
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown,
  FaMedal,
  FaLock
} from 'react-icons/fa';

import ForumCard from './ForumCard'; // Adjust path if ForumCard is located elsewhere
import ThreadCard from './ThreadCard';
import CommunityRequestModal from './CommunityRequestModal';
import FloatingComposer from './FloatingComposer';
import ModalOverlay from './ModalOverlay';
import ReportModal from './ReportModal';
import './LockedFeature.css';
import './CreationModal.css';

const ALL_TOPICS_VALUE = 'all';
const BASE_TOPIC_OPTIONS = [
  { value: 'admissions', label: 'Admissions' },
  { value: 'academics', label: 'Academics' },
  { value: 'campus-life', label: 'Campus Life' },
];

const normalizeTopicValue = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const topicLabelFromValue = (value) => {
  if (!value) return '';
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const extractForumTopicsFromForum = (forum) => {
  if (!forum) return [];
  const candidates = [forum.topics, forum.topic, forum.category, forum.categories, forum.tags];
  const collected = [];

  candidates.forEach((candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        const normalized = normalizeTopicValue(item);
        if (normalized) collected.push(normalized);
      });
    } else if (typeof candidate === 'string') {
      candidate
        .split(',')
        .map((item) => normalizeTopicValue(item))
        .filter(Boolean)
        .forEach((item) => collected.push(item));
    }
  });

  return Array.from(new Set(collected));
};

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function Feed({ activeFeed, setActiveFeed, activeSection, userData, onRequireAuth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("default"); // options: "default", "popularity", "mostUpvoted", "mostRecent"
  const [selectedTopics, setSelectedTopics] = useState([ALL_TOPICS_VALUE]);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [communityFilter, setCommunityFilter] = useState('All'); // Options: "All", "Followed", "Unfollowed"
  const [selectedCommunityTab, setSelectedCommunityTab] = useState("university");
  const [communitySort, setCommunitySort] = useState('popularity'); // 'popularity' | 'alpha'
  const [feedSort, setFeedSort] = useState('recent'); // 'recent' | 'trending'

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
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
    secondary_color: '',
    parent_community_id: ''
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [adminCommunities, setAdminCommunities] = useState([]);
  const [isLoadingAdminCommunities, setIsLoadingAdminCommunities] = useState(false);
  const [allCommunitiesSimple, setAllCommunitiesSimple] = useState([]);
  const [isLoadingAllParents, setIsLoadingAllParents] = useState(false);

  // ============== S A V E D ==============
  // We’ll store arrays for savedForums, savedThreads, savedPosts
  const [savedForums, setSavedForums] = useState([]);
  const [savedThreads, setSavedThreads] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  // Track which saved tab is active
  const [savedTab, setSavedTab] = useState('forums'); // 'forums' | 'threads' | 'posts'

  const [feedThreads, setFeedThreads] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const topicDropdownRef = useRef(null);
  const isSuperAdmin = userData?.role_id === 1;
  const INFO_COMMUNITY_ID = 'c57b7fd6c45b9d57b';

  useEffect(() => {
    console.log("Active Section:", activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'funding') {
      setShowFundingModal(true);
    }
  }, [activeSection]);

  useEffect(() => {
    if (userData) {
      fetchAdminCommunities();
    } else {
      setAdminCommunities([]);
    }
  }, [userData]);

  useEffect(() => {
    if (showRequestModal && userData) {
      fetchAdminCommunities();
      if (userData.role_id === 1) {
        fetchAllCommunitiesSimple();
      }
    }
  }, [showRequestModal, userData]);

  const handleDismissFundingModal = () => setShowFundingModal(false);

  const handleFundingNavigateHome = () => {
    setShowFundingModal(false);
    navigate('/home');
  };

  const handleOpenReport = (target) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    if (!target || !target.id || !target.type) return;
    setReportTarget({
      ...target,
      label: target.label || target.type,
      context: target.context ? target.context.trim() : '',
    });
  };

  const handleSubmitReport = async ({ reasonCode, reasonText, details }) => {
    if (!reportTarget) return;
    setIsSubmittingReport(true);
    try {
      const resp = await axios.post(
        '/api/submit_report.php',
        {
          item_type: reportTarget.type,
          item_id: reportTarget.id,
          reason_code: reasonCode,
          reason_text: reasonText,
          details,
        },
        { withCredentials: true }
      );
      if (resp.data.success) {
        setNotification({ type: 'success', message: 'Report submitted.' });
        setReportTarget(null);
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Unable to submit report.' });
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setNotification({ type: 'error', message: 'An error occurred while submitting the report.' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const reportModal = (
    <ReportModal
      isOpen={!!reportTarget}
      target={reportTarget}
      onClose={() => setReportTarget(null)}
      onSubmit={handleSubmitReport}
      submitting={isSubmittingReport}
    />
  );

  // ------------- THREAD VOTING -------------
  const handleThreadVoteClick = async (threadId, voteType) => {
    if (!userData) {
      onRequireAuth?.();
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
        .get(`/api/fetch_feed.php?user_id=${userData.user_id}&sort=${feedSort}`, {
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
  useEffect(() => {
    fetchFeedThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedSort]);

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

  const openRequestCommunityModal = () => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    // Set default type based on tab
    setRequestData((prev) => ({
      ...prev,
      type: selectedCommunityTab === 'group' ? 'group' : 'university',
      parent_community_id: ''
    }));
    if (userData.role_id === 1 && allCommunitiesSimple.length === 0) {
      fetchAllCommunitiesSimple();
    }
    setShowRequestModal(true);
  };

  // Save/Unsave a Forum
  const handleSaveForum = async (forumId, isAlreadySaved) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
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

  const fetchAdminCommunities = async () => {
    if (!userData) {
      setAdminCommunities([]);
      return;
    }
    setIsLoadingAdminCommunities(true);
    try {
      const res = await axios.get('/api/get_user_community_admins.php', { withCredentials: true });
      if (res.data.success && Array.isArray(res.data.communities)) {
        setAdminCommunities(res.data.communities);
      } else {
        setAdminCommunities([]);
      }
    } catch (err) {
      console.error('Error fetching admin communities:', err);
      setAdminCommunities([]);
    } finally {
      setIsLoadingAdminCommunities(false);
    }
  };

  const fetchAllCommunitiesSimple = async () => {
    setIsLoadingAllParents(true);
    try {
      const res = await axios.get('/api/fetch_communities.php');
      if (Array.isArray(res.data)) {
        setAllCommunitiesSimple(res.data);
      } else {
        setAllCommunitiesSimple([]);
      }
    } catch (err) {
      console.error('Error fetching all communities:', err);
      setAllCommunitiesSimple([]);
    } finally {
      setIsLoadingAllParents(false);
    }
  };

  const fetchAllCommunitiesData = async (page = 1, term = '') => {
    setIsLoadingAll(true);
    try {
      // Decide the endpoint by selectedCommunityTab
      const endpoint =
        selectedCommunityTab === "university"
          ? "/api/fetch_all_university_data.php"
          : "/api/fetch_all_group_data.php";
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('search', term);
      if (userData?.user_id) {
        params.append('user_id', String(userData.user_id));
      }
      const response = await axios.get(`${endpoint}?${params.toString()}`);
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
    setIsLoadingForums(true);
    try {
      const params = new URLSearchParams();
      params.append('community_id', String(communityId));
      if (userData?.user_id) {
        params.append('user_id', String(userData.user_id));
      }
      const resp = await axios.get(`/api/fetch_forums.php?${params.toString()}`);
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

  const topicOptions = useMemo(
    () => {
      const optionMap = new Map(BASE_TOPIC_OPTIONS.map((opt) => [opt.value, opt.label]));

      forums.forEach((forum) => {
        const forumTopics = extractForumTopicsFromForum(forum);
        forumTopics.forEach((topicValue) => {
          if (!optionMap.has(topicValue)) {
            optionMap.set(topicValue, topicLabelFromValue(topicValue));
          }
        });
      });

      return Array.from(optionMap, ([value, label]) => ({ value, label }));
    },
    [forums]
  );

  const topicOptionsWithAll = useMemo(
    () => [{ value: ALL_TOPICS_VALUE, label: 'All topics' }, ...topicOptions],
    [topicOptions]
  );

  const filteredForums = sortedForums.filter((forum) => {
    if (!selectedTopics.length || selectedTopics.includes(ALL_TOPICS_VALUE)) return true;
    const forumTopics = extractForumTopicsFromForum(forum);
    if (!forumTopics.length) return false;
    return forumTopics.some((topicValue) => selectedTopics.includes(topicValue));
  });

  const updateTopicSelection = (nextSelection) => {
    let normalized = Array.from(new Set(nextSelection.filter(Boolean).map(normalizeTopicValue))).filter(Boolean);
    if (!normalized.length || normalized.includes(ALL_TOPICS_VALUE)) {
      normalized = [ALL_TOPICS_VALUE];
    } else {
      normalized = normalized.filter((topic) => topic !== ALL_TOPICS_VALUE);
    }

    const params = new URLSearchParams(searchParams);
    params.delete('topic'); // legacy single-topic param

    if (!normalized.length || normalized.includes(ALL_TOPICS_VALUE)) {
      params.delete('topics');
    } else {
      params.set('topics', normalized.join(','));
    }

    setSelectedTopics(normalized);
    setSearchParams(params);
  };

  const handleTopicToggle = (value) => {
    const normalizedValue = normalizeTopicValue(value);
    if (!normalizedValue) return;
    if (normalizedValue === ALL_TOPICS_VALUE) {
      updateTopicSelection([ALL_TOPICS_VALUE]);
      return;
    }
    const withoutAll = selectedTopics.filter((topic) => topic !== ALL_TOPICS_VALUE);
    const hasValue = withoutAll.includes(normalizedValue);
    const next = hasValue
      ? withoutAll.filter((topic) => topic !== normalizedValue)
      : [...withoutAll, normalizedValue];
    updateTopicSelection(next);
  };

  const clearTopicFilter = () => {
    if (!selectedTopics.length) return;
    updateTopicSelection([ALL_TOPICS_VALUE]);
  };

  // Forum upvote/downvote
  const handleVoteClick = async (forumId, voteType) => {
    if (!userData) {
      onRequireAuth?.();
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
        // Refresh the "info" section’s forums
        fetchForums(INFO_COMMUNITY_ID);
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
    }
    if (activeSection === 'communities') {
      fetchAllCommunitiesData(1, '');
      setCurrentPage(1);
      setSearchTerm('');
    }
    if (activeSection === 'info') {
      // Fetch forums for the info board community
      fetchForums(INFO_COMMUNITY_ID);
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

  // ---------------- URL SYNC (Communities only; visual state only) ----------------
  // Initialize local UI state from URL params on mount or when URL changes
  useEffect(() => {
    if (activeSection !== 'communities') return;
    const kind = (searchParams.get('kind') || '').toLowerCase();
    const scope = (searchParams.get('scope') || '').toLowerCase();
    const query = searchParams.get('query') ?? '';

    if (kind === 'university' || kind === 'group') {
      if (selectedCommunityTab !== kind) setSelectedCommunityTab(kind);
    }
    if (['all', 'followed', 'unfollowed'].includes(scope)) {
      const scopeToState = scope === 'all' ? 'All' : scope.charAt(0).toUpperCase() + scope.slice(1);
      if (communityFilter !== scopeToState) setCommunityFilter(scopeToState);
    }
    if (typeof query === 'string' && searchTerm !== query) {
      setSearchTerm(query);
    }
    // We intentionally do not trigger backend calls here. Existing effects handle fetching.
  }, [activeSection, searchParams]);

  // Push UI state to URL params when it changes (no backend calls triggered by this directly)
  useEffect(() => {
    if (activeSection !== 'communities') return;
    const params = new URLSearchParams(searchParams);

    let changed = false;
    const kindParam = selectedCommunityTab; // 'university' | 'group'
    if ((params.get('kind') || '') !== kindParam) { params.set('kind', kindParam); changed = true; }

    const scopeParam = (communityFilter || 'All').toLowerCase(); // 'all' | 'followed' | 'unfollowed'
    if ((params.get('scope') || '') !== scopeParam) { params.set('scope', scopeParam); changed = true; }

    const queryParam = searchTerm || '';
    const existingQuery = params.get('query') || '';
    if (existingQuery !== queryParam) {
      if (queryParam) params.set('query', queryParam); else params.delete('query');
      changed = true;
    }

    if (changed) setSearchParams(params, { replace: true });
  }, [selectedCommunityTab, communityFilter, searchTerm, activeSection]);

  // Sync topic filter from URL when on Info board
  useEffect(() => {
    if (activeSection !== 'info') {
      if (selectedTopics.length !== 1 || selectedTopics[0] !== ALL_TOPICS_VALUE) {
        setSelectedTopics([ALL_TOPICS_VALUE]);
      }
      return;
    }

    const topicsParam = searchParams.get('topics') ?? searchParams.get('topic') ?? '';
    const parsedTopics = topicsParam
      ? topicsParam
          .split(',')
          .map((topic) => normalizeTopicValue(topic))
          .filter(Boolean)
      : [ALL_TOPICS_VALUE];
    let normalizedTopics = Array.from(new Set(parsedTopics));
    if (normalizedTopics.includes(ALL_TOPICS_VALUE) && normalizedTopics.length > 1) {
      normalizedTopics = normalizedTopics.filter((topic) => topic !== ALL_TOPICS_VALUE);
    }
    if (!normalizedTopics.length) normalizedTopics = [ALL_TOPICS_VALUE];
    const matchesSelection =
      normalizedTopics.length === selectedTopics.length &&
      normalizedTopics.every((topic) => selectedTopics.includes(topic));

    if (!matchesSelection) {
      setSelectedTopics(normalizedTopics);
    }
  }, [activeSection, searchParams, selectedTopics]);

  // Close topic dropdown when clicking outside
  useEffect(() => {
    if (!isTopicDropdownOpen) return undefined;
    const handleClickOutside = (event) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target)) {
        setIsTopicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isTopicDropdownOpen]);

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
    if (!userData) {
      onRequireAuth?.();
      return;
    }
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
    if (!isSuperAdmin) {
      setNotification({ type: 'error', message: 'Only super admins can create forums.' });
      return;
    }
    setIsCreatingForum(true);
    // Info board community id (fixed)
    const infoCommunityId = 'c57b7fd6c45b9d57b';
    try {
      const resp = await axios.post('/api/create_forum.php', {
        community_id: infoCommunityId,
        name: newForumName,
        description: newForumDescription
      });
      if (resp.data.success) {
        setNewForumName('');
        setNewForumDescription('');
        setShowCreateForumModal(false);
        fetchForums(infoCommunityId);
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

  const handleDismissCreateForumModal = () => {
    setShowCreateForumModal(false);
    setNewForumName('');
    setNewForumDescription('');
    setIsCreatingForum(false);
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
        fetchForums(INFO_COMMUNITY_ID);
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
      onRequireAuth?.();
      return;
    }
    try {
      const resp = await axios.post('/api/delete_forum.php', { forum_id });
      if (resp.data.success) {
        fetchForums(INFO_COMMUNITY_ID);
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

    const isSubCommunity = requestData.type === 'sub_community';
    if (isSubCommunity && !requestData.parent_community_id) {
      setNotification({ type: 'error', message: 'Select a parent community for the sub-community.' });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const endpoint = isSuperAdmin ? '/api/create_community.php' : '/api/request_community.php';
      const payload = {
        ...requestData,
        type: isSubCommunity ? 'sub_community' : requestData.type,
        parent_community_id: isSubCommunity ? requestData.parent_community_id : ''
      };

      // Map to DB types when super admin creates directly
      if (endpoint === '/api/create_community.php' && payload.type === 'sub_community') {
        payload.type = 'group';
        if (!payload.parent_community_id) {
          setNotification({ type: 'error', message: 'Select a parent community for the sub-community.' });
          setIsSubmittingRequest(false);
          return;
        }
      }

      const resp = await axios.post(endpoint, payload, { withCredentials: true });
      if (resp.data.success) {
        setRequestData({
          name: '',
          type: '',
          description: '',
          tagline: '',
          location: '',
          website: '',
          primary_color: '',
          secondary_color: '',
          parent_community_id: ''
        });
        setShowRequestModal(false);
        const successMsg =
          endpoint === '/api/create_community.php'
            ? 'Community created.'
            : 'Request submitted.';
        setNotification({ type: 'success', message: successMsg });
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
      fetchFeedThreads();
    }
  }, [activeSection, activeFeed, userData, feedSort]);  

  // We have "mockPosts" concept in the original code to display fallback content
  let mockPosts = [];

  const normalizeId = (value) => (value === null || value === undefined ? '' : String(value));

  // Create a set for quick lookup of followed community IDs (normalized to strings)
  const followedIds = useMemo(
    () => new Set(followedCommunities.map((c) => normalizeId(c.community_id))),
    [followedCommunities]
  );

  const isCommunityFollowed = (community) => {
    const communityId = normalizeId(community.community_id);
    const backendFlag = community.is_followed === true || community.is_followed === 1 || community.is_followed === '1';
    return backendFlag || followedIds.has(communityId);
  };

  // Filter communities by type (tab) and filter (All, Followed, Unfollowed)
  const filteredCommunities = allCommunities
    .filter((community) => {
      // Must match the selected tab type
      if (community.community_type !== selectedCommunityTab) return false;

      // Then apply filter
      if (communityFilter === 'Followed') {
        return isCommunityFollowed(community);
      } else if (communityFilter === 'Unfollowed') {
        return !isCommunityFollowed(community);
      }
      return true;
    })
    .sort((a, b) => {
      const sortMode = communitySort || 'popularity';
      if (sortMode === 'alpha') {
        return a.name.localeCompare(b.name);
      }
      // popularity / fallback: sort by followers descending
      const aFollowers = Number(a.followers_count || 0);
      const bFollowers = Number(b.followers_count || 0);
      return bFollowers - aFollowers;
    });

  // Clear filters helper (for empty state action)
  const clearCommunityFilters = () => {
    setCommunityFilter('All');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Keep Home tab selection in sync with URL (?tab=feed|explore)
  useEffect(() => {
    if (activeSection !== 'home') return;
    const tab = searchParams.get('tab');
    const desired = tab === 'explore' ? 'explore' : 'yourFeed';
    if (!userData && desired === 'yourFeed') {
      if (activeFeed !== 'explore') {
        setActiveFeed('explore');
      }
      return;
    }
    if (activeFeed !== desired) {
      setActiveFeed(desired);
    }
    if (!tab) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', userData ? 'feed' : 'explore');
      setSearchParams(params, { replace: true });
    }
  }, [activeSection, searchParams, activeFeed, setActiveFeed, setSearchParams]);

  // ------------- RENDER LOGIC -------------
  // HOME SECTION
  if (activeSection === 'home') {
    return (
      <main>
        {reportModal}
        <div className="feed-container">
          {/* Hero */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h1 className="section-title" style={{ marginBottom: 0 }}>
              {activeFeed === 'yourFeed' ? 'Your Feed' : 'Explore'}
            </h1>
          </div>
          <p style={{ marginTop: 0, color: 'var(--muted-text)' }}>
            Welcome back, {userData?.first_name ? `${userData.first_name}` : 'there'}!
          </p>
          <div className="section-controls">
            <span className="sort-pill">Feed</span>
            <div className="chips-row">
              <button
                type="button"
                className={`chip your-feed-chip ${activeFeed === 'yourFeed' ? 'active' : ''} ${!userData ? 'chip-locked' : ''}`}
                onClick={() => {
                  if (!userData) {
                    onRequireAuth?.();
                    return;
                  }
                  if (activeFeed !== 'yourFeed') {
                    setActiveFeed('yourFeed');
                  }
                  const params = new URLSearchParams(searchParams);
                  if (params.get('tab') !== 'feed') {
                    params.set('tab', 'feed');
                    setSearchParams(params);
                  }
                }}
                aria-disabled={!userData}
                title={!userData ? 'Log in to access Your Feed' : 'View Your Feed'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!userData && <FaLock size={12} />}
                  Your Feed
                </span>
              </button>
              <button
                type="button"
                className={`chip ${activeFeed === 'explore' ? 'active' : ''}`}
                onClick={() => {
                  if (activeFeed !== 'explore') {
                    setActiveFeed('explore');
                  }
                  const params = new URLSearchParams(searchParams);
                  if (params.get('tab') !== 'explore') {
                    params.set('tab', 'explore');
                    setSearchParams(params);
                  }
                }}
              >
                Explore
              </button>
            </div>
          </div>

          {activeFeed === 'yourFeed' && userData ? (
            <>
              <div className="feed-controls" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
                <label htmlFor="feed-sort" className="muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Sort:
                  <select
                    id="feed-sort"
                    value={feedSort}
                    onChange={(e) => setFeedSort(e.target.value)}
                  >
                    <option value="recent">Most Recent</option>
                    <option value="trending">Trending</option>
                  </select>
                </label>
              </div>
              {isLoadingFeed ? (
                <p>Loading feed...</p>
              ) : feedThreads.length === 0 ? (
                <div className="empty-feed-card">
                  <p style={{ marginBottom: '8px', fontWeight: 600 }}>Your feed is currently empty.</p>
                  <p className="muted" style={{ marginBottom: '12px' }}>
                    Follow some of our most popular or recommended communities to see fresh threads here.
                  </p>
                  <button
                    type="button"
                    className="pill-button"
                    onClick={() => {
                      navigate('/communities');
                    }}
                  >
                    Browse communities
                  </button>
                </div>
              ) : (
                feedThreads.map((thread) => (
                  <ThreadCard
                    key={thread.thread_id}
                    thread={thread}
                    userData={userData}
                    onUpvote={handleThreadUpvoteClick}
                    onDownvote={handleThreadDownvoteClick}
                    onReport={() =>
                      handleOpenReport({
                        id: thread.thread_id,
                        type: 'thread',
                        label: thread.title || 'thread',
                        context: stripHtml(thread.title || ''),
                      })
                    }
                  />
                ))
              )}
            </>
          ) : activeFeed === 'explore' ? (
            // DUMMY Explore content
            <div className="explore-dummy">
              <p>This is some dummy explore content!</p>
              {/* Additional dummy content here */}
            </div>
          ) : (
            <div className="locked-feature-card" style={{ textAlign: 'center' }}>
              <p>Your Feed is available once you create an account or log in.</p>
              <button className="pill-button" onClick={() => navigate('/signup')}>
                Create Account
              </button>
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
        {reportModal}
        <div className="feed-container">
          <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>Communities</h1>
          {/* Top control bar: tabs + scope + search + action (sticky under header) */}
          <div className="section-controls section-controls-sticky">
            <div className="community-controls">
              <div className="control-group">
                <span className="sort-pill">Type</span>
                <div className="chips-row">
                  <button
                    type="button"
                    onClick={() => setSelectedCommunityTab('university')}
                    className={`chip ${selectedCommunityTab === 'university' ? 'active' : ''}`}
                  >
                    Universities
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCommunityTab('group')}
                    className={`chip ${selectedCommunityTab === 'group' ? 'active' : ''}`}
                  >
                    Groups
                  </button>
                </div>
              </div>

              <div className="control-group">
                <span className="sort-pill">Filter</span>
                <div className="chips-row">
                  <button
                    type="button"
                    className={`chip ${communityFilter === 'All' ? 'active' : ''}`}
                    onClick={() => setCommunityFilter('All')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`chip ${communityFilter === 'Followed' ? 'active' : ''}`}
                    onClick={() => setCommunityFilter('Followed')}
                  >
                    Followed
                  </button>
                  <button
                    type="button"
                    className={`chip ${communityFilter === 'Unfollowed' ? 'active' : ''}`}
                    onClick={() => setCommunityFilter('Unfollowed')}
                  >
                    Unfollowed
                  </button>
                </div>
              </div>

              {selectedCommunityTab === 'group' && (
                <div className="control-action">
                  <button
                    type="button"
                    className="pill-button community-request-button"
                    onClick={openRequestCommunityModal}
                    aria-disabled={!userData}
                  >
                    {isSuperAdmin ? '+ Create Group' : '+ Request Group'}
                  </button>
                </div>
              )}
              {selectedCommunityTab === 'university' && (
                <div className="control-action">
                  <button
                    type="button"
                    className="pill-button community-request-button"
                    onClick={openRequestCommunityModal}
                    aria-disabled={!userData}
                  >
                    + Request University
                  </button>
                </div>
              )}

              <div className="control-search">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    id="community-search"
                    type="text"
                    placeholder="Search universities, groups…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pill-search"
                    style={{ minWidth: '220px', flex: 1 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label htmlFor="community-sort" className="sort-pill" style={{ margin: 0 }}>
                      Sort
                    </label>
                    <select
                      id="community-sort"
                      value={communitySort}
                      onChange={(e) => setCommunitySort(e.target.value)}
                      className="sort-select"
                    aria-label="Sort communities"
                  >
                    <option value="popularity">Most Followers</option>
                    <option value="alpha">A-Z</option>
                  </select>
                </div>
              </div>
              </div>
            </div>
          </div>

          <div className="communities-section">
            {isLoadingAll ? (
              <div className="community-list">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="community-row-card skeleton animate-pulse">
                    <div className="skeleton-circle" aria-hidden />
                    <div className="community-row-content">
                      <div className="skeleton-line" style={{ width: '52%' }} aria-hidden />
                      <div className="skeleton-line" style={{ width: '72%', marginTop: 6 }} aria-hidden />
                    </div>
                    <div className="community-row-actions">
                      <div className="skeleton-pill" aria-hidden />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCommunities.length > 0 ? (
              <div className="community-list space-y-3">
                {filteredCommunities.map((community) => {
                  const isFollowed = isCommunityFollowed(community);
                  const logoSrc =
                    community.logo_path && community.logo_path.startsWith('/')
                      ? community.logo_path
                      : `/uploads/logos/${community.logo_path || 'default-logo.png'}`;
                  return (
                    <div
                      key={community.community_id}
                      className={`community-row-card${isFollowed ? ' followed' : ''}`}
                    >
                      <img
                        src={logoSrc}
                        alt={`${community.name} Logo`}
                        className="community-row-logo"
                        loading="lazy"
                      />
                      <div className="community-row-content">
                        <div className="community-row-header">
                          <h4 className="community-name" style={{ margin: 0 }}>
                            <Link
                              to={`/${community.community_type}/${community.community_id}`}
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              <span className="truncate-38ch">{community.name}</span>
                            </Link>
                          </h4>
                        </div>
                        {community.tagline && (
                          <p className="community-slogan" style={{ margin: '2px 0' }}>{community.tagline}</p>
                        )}
                        <div className="community-row-meta">
                          {community.location && (
                            <span className="community-location">{community.location}</span>
                          )}
                          <span className="followers-count" style={{ marginLeft: community.location ? 12 : 0 }}>
                            Followers: {community.followers_count || 0}
                          </span>
                          {typeof community.following_count !== 'undefined' && (
                            <>
                              <span className="following-count" style={{ marginLeft: 12 }}>
                                Following: {community.following_count}
                              </span>
                            </>
                          )}
                          {typeof community.admin_count !== 'undefined' && (
                            <>
                              <span className="admin-count" style={{ marginLeft: 12 }}>
                                Admins: {community.admin_count}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="community-row-actions">
                        <button
                          type="button"
                          className={`follow-button ${isFollowed ? 'unfollow' : 'follow'} ${!userData ? 'locked' : ''}`}
                          onClick={() => {
                            if (!userData) {
                              onRequireAuth?.();
                              return;
                            }
                            handleFollowToggle(community.community_id, isFollowed);
                          }}
                          aria-disabled={!userData}
                          title={!userData ? 'Log in to follow communities' : isFollowed ? 'Unfollow community' : 'Follow community'}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {!userData && <FaLock size={12} />}
                            {isFollowed ? 'Unfollow' : 'Follow'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-card">
                <p className="empty-state-text">
                  No communities match your filters.
                </p>
                <button type="button" className="secondary-button" onClick={clearCommunityFilters}>
                  Clear Filters
                </button>
              </div>
            )}

            {/* Pagination */}
            <div className="pagination-controls">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                Last
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
            title={
              isSuperAdmin && selectedCommunityTab === 'group'
                ? 'Create Group'
                : 'Request New Community'
            }
            submitLabel={isSuperAdmin && selectedCommunityTab === 'group' ? 'Create' : 'Submit'}
            lockType={false}
            allowSubCommunity={isSuperAdmin || adminCommunities.length > 0}
            parentCommunities={
              isSuperAdmin ? allCommunitiesSimple : adminCommunities
            }
            isLoadingParents={
              isSuperAdmin ? isLoadingAllParents : isLoadingAdminCommunities
            }
          />
        )}
      </main>
    );
  }

  // INFO SECTION
  if (activeSection === 'info') {
    const isAllTopicsSelected = selectedTopics.includes(ALL_TOPICS_VALUE) || !selectedTopics.length;
    const selectedTopicLabels = isAllTopicsSelected
      ? 'All topics'
      : selectedTopics
          .map((topic) => {
            const match = topicOptionsWithAll.find((opt) => opt.value === topic);
            return match ? match.label : topicLabelFromValue(topic);
          })
          .join(', ');

    return (
      <main>
        {reportModal}
        <div className="feed-container">
          <div
            className="feed-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: 'none',
              marginBottom: '0.5rem',
            }}
          >
            <h1 className="section-title" style={{ margin: 0 }}>Info Board</h1>
          </div>

          <p style={{ marginTop: 0, color: 'var(--muted-text)' }}>
            Welcome back, {userData?.first_name ? `${userData.first_name}` : 'there'}!
          </p>

          {/* Controls: Sort pill + topic chips */}
          <div className="section-controls info-controls">
            <span className="sort-pill">Sort</span>
            <label htmlFor="sort-by" className="sr-only">Sort by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="mostRecent">Most Recent</option>
              <option value="popularity">Popularity</option>
              <option value="mostUpvoted">Most Upvoted</option>
            </select>

            <span className="sort-pill">Topics</span>
            <div className="topic-multi-select-wrapper">
              <div className="topic-dropdown" ref={topicDropdownRef}>
                <button
                  type="button"
                  className={`topic-dropdown-toggle${isTopicDropdownOpen ? ' open' : ''}`}
                  onClick={() => setIsTopicDropdownOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={isTopicDropdownOpen}
                >
                  <span className="topic-dropdown-label">{selectedTopicLabels}</span>
                </button>
                {isTopicDropdownOpen && (
                  <div className="topic-dropdown-menu" role="listbox" aria-multiselectable="true">
                    {topicOptionsWithAll.map((topicOption) => {
                      const checked =
                        selectedTopics.includes(topicOption.value) ||
                        (isAllTopicsSelected && topicOption.value === ALL_TOPICS_VALUE);
                      return (
                        <label key={topicOption.value} className="topic-dropdown-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleTopicToggle(topicOption.value)}
                          />
                          <span>{topicOption.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="topic-selection-meta">
                <button
                  type="button"
                  className="clear-topics-button"
                  onClick={clearTopicFilter}
                  disabled={isAllTopicsSelected}
                >
                  Clear
                </button>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="control-action">
                <button
                  type="button"
                  className="pill-button community-request-button"
                  onClick={() => setShowCreateForumModal(true)}
                >
                  + New Forum
                </button>
              </div>
            )}
          </div>

          {/* CREATE FORUM MODAL */}
          {showCreateForumModal && (
            <ModalOverlay
              isOpen={showCreateForumModal}
              onClose={handleDismissCreateForumModal}
            >
              <div className="creation-modal">
                <div className="creation-modal__form">
                  <div className="creation-modal__header">
                    <div>
                      <p className="creation-modal__meta">Info Board</p>
                      <h3 className="creation-modal__title">Create a new forum</h3>
                      <p className="creation-modal__sub">
                        Titles and descriptions should help members instantly know if they&apos;re in the right place.
                      </p>
                      <ul className="creation-points">
                        <li>Give it a concise, action-oriented name</li>
                        <li>Share what belongs here and what does not</li>
                        <li>Invite members to add context in every thread</li>
                      </ul>
                    </div>
                  </div>
                  <form className="creation-fields" onSubmit={handleCreateForumSubmit}>
                    <div className="creation-field">
                      <label htmlFor="forum-name">Forum name</label>
                      <input
                        type="text"
                        id="forum-name"
                        value={newForumName}
                        onChange={(e) => setNewForumName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="creation-field">
                      <label htmlFor="forum-description">Description</label>
                      <textarea
                        id="forum-description"
                        value={newForumDescription}
                        onChange={(e) => setNewForumDescription(e.target.value)}
                        required
                      />
                    </div>
                    <div className="creation-actions">
                      <button
                        type="button"
                        className="creation-ghost"
                        onClick={handleDismissCreateForumModal}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="creation-primary"
                        disabled={isCreatingForum}
                      >
                        {isCreatingForum ? 'Creating...' : 'Create forum'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </ModalOverlay>
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

          <h2 className="forum-title" style={{ marginTop: '8px' }}>Forums</h2>
          {isLoadingForums ? (
            <p>Loading forums...</p>
          ) : filteredForums.length === 0 ? (
            <p>{isAllTopicsSelected ? 'No forums available.' : 'No forums match these topics.'}</p>
          ) : (
            <div className="forum-list">
              {filteredForums.map((forum) => (
                <ForumCard
                  key={forum.forum_id}
                  forum={forum}
                  userData={userData}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  toggleMenu={toggleMenu}
                  onReport={(f) =>
                    handleOpenReport({
                      id: f.forum_id,
                      type: 'forum',
                      label: f.name || 'forum',
                      context: stripHtml(f.description || f.name || '').slice(0, 200),
                    })
                  }
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
        {/* FAB visible on Home (Your Feed + Explore) for super admins or ambassadors */}
        {activeSection === 'home' && userData && (Number(userData.role_id) === 1 || Number(userData.is_ambassador) === 1) && (
          <FloatingComposer
            communities={[...followedCommunities, ...allCommunities]}
          />
        )}
      </main>
    );
  }

  // FUNDING SECTION
  if (activeSection === 'funding') {
    return (
      <main>
        {reportModal}
        <div className="feed-container">
          <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>Funding</h1>
          <p style={{ marginTop: 0, color: 'var(--muted-text)' }}>
            We&apos;re crafting a richer funding experience. Stay tuned!
          </p>
        </div>
        <ModalOverlay
          isOpen={showFundingModal}
          onClose={handleDismissFundingModal}
          showCloseButton={false}
        >
          <div className="locked-feature-wrapper">
            <div className="locked-feature-card coming-soon-card">
              <div className="locked-icon-circle">
                <FaMedal />
              </div>
              <p className="locked-chip">Funding lab</p>
              <h2>Funding hub is coming soon</h2>
              <p>
                We&apos;re building curated scholarship tracking, mentor tips, and deadline reminders
                so you can secure the support you need faster.
              </p>
              <div className="coming-soon-actions">
                <button className="primary" onClick={handleFundingNavigateHome}>
                  Go back home
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      </main>
    );
  }

  // SAVED SECTION
  if (activeSection === 'saved' && userData) {
    return (
      <main>
        {reportModal}
        <div className="feed-container">
          <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>Saved</h1>
          <p style={{ marginTop: 0, color: 'var(--muted-text)' }}>
            Curate your favorites across forums, threads, and posts.
          </p>
          <div className="section-controls">
            <span className="sort-pill">View</span>
            <div className="chips-row">
              <button
                type="button"
                className={`chip ${savedTab === 'forums' ? 'active' : ''}`}
                onClick={() => setSavedTab('forums')}
              >
                Forums
              </button>
              <button
                type="button"
                className={`chip ${savedTab === 'threads' ? 'active' : ''}`}
                onClick={() => setSavedTab('threads')}
              >
                Threads
              </button>
              <button
                type="button"
                className={`chip ${savedTab === 'posts' ? 'active' : ''}`}
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
                  <div key={f.forum_id} className="forum-card card-lift">
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
                  <div key={t.thread_id} className="forum-card card-lift">
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
                  <div key={p.post_id} className="forum-card card-lift">
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
      {reportModal}
      {['home', 'connections', 'funding'].includes(activeSection) &&
        activeSection !== 'info' &&
        activeSection !== 'communities' &&
        activeSection !== 'saved' &&
        mockPosts.map((post, i) => (
          <div key={i} className="post-card card-lift">
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
