// src/components/Feed.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FaLock,
  FaFilter
} from 'react-icons/fa';
import {
  ArrowUpRight,
  BadgeDollarSign,
  Bookmark,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  Compass,
  GraduationCap,
  LibraryBig,
  MoreVertical,
  Search,
  Users,
} from 'lucide-react';

import ForumCard from './ForumCard'; // Adjust path if ForumCard is located elsewhere
import ThreadCard from './ThreadCard';
import CommunityRequestModal from './CommunityRequestModal';
import FloatingComposer from './FloatingComposer';
import ModalOverlay from './ModalOverlay';
import buildUploadSrc from '../utils/uploads';
import ReportModal from './ReportModal';
import TagPicker from './TagPicker';
import useTagOptions from '../hooks/useTagOptions';
import { mapTagNamesToSlugs } from '../utils/tagUtils';
import { IMAGE_LAYOUTS, normalizeImageLayout } from '../utils/imageLayout';
import { FORUM_TITLE_MAX_LENGTH } from '../utils/contentLimits';
import { isSuperAdmin } from '../constants/roles';
import { useLanguage } from '../i18n/LanguageContext';
import './LockedFeature.css';
import './CreationModal.css';
import './HomeDashboard.css';

const ALL_TOPICS_VALUE = 'all';

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

const formatSavedAt = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const summarizeContent = (value = '', maxLength = 200) => {
  const plain = stripHtml(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}...`;
};

const summarizeWithEllipsis = (value = '', maxLength = 200) => {
  const summary = summarizeContent(value, maxLength);
  if (!summary) return '';
  return summary.endsWith('...') ? summary : `${summary}...`;
};

const SAVED_CARD_MAX_CHARS = 50;

const normalizeDisplayId = (value) =>
  String(value || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^#/, '');

function Feed({ activeFeed, setActiveFeed, activeSection, userData, userInterests = [], onRequireAuth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, locale, t } = useLanguage();
  const { tags: tagOptions } = useTagOptions();
  const [sortBy, setSortBy] = useState("default"); // options: "default", "popularity", "mostUpvoted", "mostRecent"
  const [selectedTopics, setSelectedTopics] = useState([ALL_TOPICS_VALUE]);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [communityFilter, setCommunityFilter] = useState('All'); // Options: "All", "Followed", "Unfollowed"
  const [selectedCommunityTab, setSelectedCommunityTab] = useState("university");
  const [communitySort, setCommunitySort] = useState('popularity'); // 'popularity' | 'alpha'
  const [showCommunityFilters, setShowCommunityFilters] = useState(false);
  const [feedSort, setFeedSort] = useState('recent'); // 'recent' | 'trending'
  const [showHomeFilters, setShowHomeFilters] = useState(false);

  const [followedCommunities, setFollowedCommunities] = useState([]);
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
  const [newForumTags, setNewForumTags] = useState([]);
  const [newForumBannerFile, setNewForumBannerFile] = useState(null);
  const [newForumBannerPreview, setNewForumBannerPreview] = useState('');
  const [newForumImageLayout, setNewForumImageLayout] = useState('banner');
  const [isCreatingForum, setIsCreatingForum] = useState(false);

  const [editForumId, setEditForumId] = useState(null);
  const [editForumName, setEditForumName] = useState('');
  const [editForumDescription, setEditForumDescription] = useState('');
  const [editForumTags, setEditForumTags] = useState([]);
  const [editForumBannerFile, setEditForumBannerFile] = useState(null);
  const [editForumBannerPreview, setEditForumBannerPreview] = useState('');
  const [editForumImageLayout, setEditForumImageLayout] = useState('banner');
  const [isEditingForum, setIsEditingForum] = useState(false);

  const [notification, setNotification] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  useEffect(() => {
    if (!newForumBannerFile) {
      setNewForumBannerPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(newForumBannerFile);
    setNewForumBannerPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [newForumBannerFile]);

  useEffect(() => {
    if (!editForumBannerFile) return undefined;
    const previewUrl = URL.createObjectURL(editForumBannerFile);
    setEditForumBannerPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editForumBannerFile]);

  const notificationNode = notification ? (
    <div className={`notification ${notification.type}`}>
      {notification.message}
      <button
        className="notification-close"
        onClick={() => setNotification(null)}
      >
        X
      </button>
    </div>
  ) : null;

  const withNotification = (content) => (
    <>
      {content}
      {notificationNode}
    </>
  );

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
  const [savedSearch, setSavedSearch] = useState('');
  const [openSavedMenu, setOpenSavedMenu] = useState(null);
  // Track which saved tab is active
  const [savedTab, setSavedTab] = useState('forums'); // 'forums' | 'threads' | 'posts'
  const [feedThreads, setFeedThreads] = useState([]);
  const [feedForums, setFeedForums] = useState([]);
  const [yourFeedView, setYourFeedView] = useState('forums'); // 'forums' | 'threads'
  const [exploreView, setExploreView] = useState('forums'); // 'forums' | 'threads'
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [exploreTags, setExploreTags] = useState([]);
  const [exploreForums, setExploreForums] = useState([]);
  const [exploreThreads, setExploreThreads] = useState([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
  const [isExploreDropdownOpen, setIsExploreDropdownOpen] = useState(false);
  const [exploreLabelText, setExploreLabelText] = useState(() => t('home.allTags'));
  const topicDropdownRef = useRef(null);
  const exploreDropdownRef = useRef(null);
  const exploreLabelRef = useRef(null);
  const feedSegmentRef = useRef(null);
  const feedContentRef = useRef(null);
  const exploreContentRef = useRef(null);
  const communityTypeRef = useRef(null);
  const communityFilterRef = useRef(null);
  const homeReadingRoomRef = useRef(null);
  const savedSegmentRef = useRef(null);
  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const INFO_COMMUNITY_ID = 'c57b7fd6c45b9d57b';

  useEffect(() => {
    if (!openSavedMenu) return undefined;
    const handlePointerDown = (event) => {
      if (!event.target.closest('.saved-card__menu')) {
        setOpenSavedMenu(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openSavedMenu]);

  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const skipUrlSyncRef = useRef(false);
  const searchTermRef = useRef(searchTerm);
  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  const safeSetSearchParams = useCallback(
    (nextParams, options) => {
      try {
        const nextString = new URLSearchParams(nextParams).toString();
        const currentString = searchParamsRef.current.toString();
        if (nextString === currentString) return;
        setSearchParams(nextParams, options);
      } catch (err) {
        console.error('Error updating URL params:', err);
      }
    },
    [setSearchParams]
  );

  useEffect(() => {
    console.log("Active Section:", activeSection);
  }, [activeSection]);

  const updateSegmentIndicator = useCallback((ref) => {
    const container = ref?.current;
    if (!container) return;
    const activeChip = container.querySelector('.chip.active');
    if (!activeChip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    const left = Math.max(chipRect.left - containerRect.left, 0);
    const width = chipRect.width;
    container.style.setProperty('--seg-left', `${left}px`);
    container.style.setProperty('--seg-width', `${width}px`);
  }, []);

  const scheduleSegmentUpdate = useCallback((ref) => {
    const run = () => updateSegmentIndicator(ref);
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [updateSegmentIndicator]);

  useEffect(() => {
    return scheduleSegmentUpdate(feedSegmentRef);
  }, [activeFeed, scheduleSegmentUpdate]);

  useEffect(() => {
    if (activeSection !== 'home') return undefined;
    if (activeFeed === 'yourFeed') {
      return scheduleSegmentUpdate(feedContentRef);
    }
    if (activeFeed === 'explore') {
      return scheduleSegmentUpdate(exploreContentRef);
    }
    return undefined;
  }, [activeSection, activeFeed, yourFeedView, exploreView, scheduleSegmentUpdate]);

  useEffect(() => {
    return scheduleSegmentUpdate(communityTypeRef);
  }, [selectedCommunityTab, scheduleSegmentUpdate]);

  useEffect(() => {
    return scheduleSegmentUpdate(communityFilterRef);
  }, [communityFilter, scheduleSegmentUpdate]);

  useEffect(() => {
    return scheduleSegmentUpdate(savedSegmentRef);
  }, [savedTab, savedForums.length, savedThreads.length, savedPosts.length, scheduleSegmentUpdate]);

  useEffect(() => {
    return scheduleSegmentUpdate(feedSegmentRef);
  }, [activeSection, scheduleSegmentUpdate]);

  useEffect(() => {
    if (activeSection === 'communities') {
      const cleanupType = scheduleSegmentUpdate(communityTypeRef);
      const cleanupFilter = scheduleSegmentUpdate(communityFilterRef);
      return () => {
        if (cleanupType) cleanupType();
        if (cleanupFilter) cleanupFilter();
      };
    }
    if (activeSection === 'saved') {
      return scheduleSegmentUpdate(savedSegmentRef);
    }
  }, [activeSection, showCommunityFilters, scheduleSegmentUpdate]);

  useEffect(() => {
    const handleResize = () => {
      updateSegmentIndicator(feedSegmentRef);
      updateSegmentIndicator(feedContentRef);
      updateSegmentIndicator(exploreContentRef);
      updateSegmentIndicator(communityTypeRef);
      updateSegmentIndicator(communityFilterRef);
      updateSegmentIndicator(savedSegmentRef);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSegmentIndicator]);

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
      if (isSuperAdminUser) {
        fetchAllCommunitiesSimple();
      }
    }
  }, [showRequestModal, userData]);

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
            setFeedForums(response.data.forums || []);
          } else {
            console.error("Error fetching feed:", response.data.error);
            setFeedForums([]);
          }
        })
        .catch((error) => {
          console.error("Error fetching feed:", error);
          setFeedForums([]);
        })
        .finally(() => {
          setIsLoadingFeed(false);
        });
    }
  };
  const hasInterests = Array.isArray(userInterests) && userInterests.length > 0;
  useEffect(() => {
    fetchFeedThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedSort]);

  const fetchExplore = () => {
    if (activeSection !== 'home' || activeFeed !== 'explore') return;
    setIsLoadingExplore(true);
    const params = new URLSearchParams();
    if (exploreTags.length) {
      params.set('tags', exploreTags.join(','));
    }
    axios
      .get(`/api/fetch_explore.php?${params.toString()}`)
      .then((resp) => {
        if (resp.data.success) {
          setExploreForums(resp.data.forums || []);
          setExploreThreads(resp.data.threads || []);
        } else {
          setExploreForums([]);
          setExploreThreads([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching explore data:', error);
        setExploreForums([]);
        setExploreThreads([]);
      })
      .finally(() => {
        setIsLoadingExplore(false);
      });
  };

  useEffect(() => {
    fetchExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeFeed, exploreTags]);

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
    if (isSuperAdminUser && allCommunitiesSimple.length === 0) {
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
        setNotification({ type: 'success', message: isAlreadySaved ? 'Forum unsaved!' : 'Forum saved!' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Unknown error.' });
      }
    } catch (error) {
      console.error('Error saving/unsaving forum:', error);
      setNotification({ type: 'error', message: 'An error occurred while saving/unsaving the forum.' });
    }
    setOpenMenuId(null);
  };

  const handleUnsaveThread = async (threadId) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    try {
      const resp = await axios.post(
        '/api/unsave_thread.php',
        { user_id: userData.user_id, thread_id: threadId },
        { withCredentials: true }
      );
      if (resp.data.success) {
        await fetchSavedThreads();
        setNotification({ type: 'success', message: 'Thread unsaved!' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Unable to unsave thread.' });
      }
    } catch (error) {
      console.error('Error unsaving thread:', error);
      setNotification({ type: 'error', message: 'An error occurred while unsaving the thread.' });
    }
  };

  const handleUnsavePost = async (postId) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    try {
      const resp = await axios.post(
        '/api/unsave_post.php',
        { user_id: userData.user_id, post_id: postId },
        { withCredentials: true }
      );
      if (resp.data.success) {
        await fetchSavedPosts();
        setNotification({ type: 'success', message: 'Comment unsaved!' });
      } else {
        setNotification({ type: 'error', message: resp.data.error || 'Unable to unsave comment.' });
      }
    } catch (error) {
      console.error('Error unsaving post:', error);
      setNotification({ type: 'error', message: 'An error occurred while unsaving the comment.' });
    }
  };

  // ------------- COMMUNITIES -------------
  const fetchFollowedCommunities = async () => {
    if (!userData) return;
    try {
      const response = await axios.get(
        `/api/followed_communities.php?user_id=${userData.user_id}`
      );
      setFollowedCommunities(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching followed communities:', error);
      setFollowedCommunities([]);
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
      const scopeValue =
        communityFilter === 'Followed'
          ? 'followed'
          : communityFilter === 'Unfollowed'
            ? 'unfollowed'
            : 'all';
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('search', term);
      params.append('scope', scopeValue);
      params.append('sort', communitySort || 'popularity');
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
      if (String(communityId) === INFO_COMMUNITY_ID) {
        params.append('lang', language);
      }
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
      const optionMap = new Map(
        (tagOptions || []).map((opt) => [
          normalizeTopicValue(opt.slug || opt.name),
          opt.name
        ])
      );

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
    [forums, tagOptions]
  );

  const topicOptionsWithAll = useMemo(
    () => [{ value: ALL_TOPICS_VALUE, label: 'All tags' }, ...topicOptions],
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
    safeSetSearchParams(params);
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

  const clearExploreTags = () => {
    setExploreTags([]);
  };

  // tag click handlers removed; tags are display-only

  const exploreTagOptions = useMemo(
    () => (tagOptions || []).map((opt) => ({ value: opt.slug, label: opt.name })),
    [tagOptions]
  );

  const exploreSelectedLabels = useMemo(() => {
    if (!exploreTags.length) return t('home.allTags');
    const labels = exploreTags.map(
      (slug) => exploreTagOptions.find((opt) => opt.value === slug)?.label || slug
    );
    return labels.join(', ');
  }, [exploreTags, exploreTagOptions, t]);

  useEffect(() => {
    setExploreLabelText(exploreSelectedLabels);
  }, [exploreSelectedLabels]);

  useEffect(() => {
    const measure = () => {
      if (!exploreLabelRef.current) return;
      const el = exploreLabelRef.current;
      const isOverflowing =
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      if (isOverflowing && exploreTags.length > 0) {
        setExploreLabelText(t('home.filtersSelected', { count: exploreTags.length }));
      } else {
        setExploreLabelText(exploreSelectedLabels);
      }
    };

    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [exploreSelectedLabels, exploreTags.length, isExploreDropdownOpen, t]);

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
    if ((activeSection === 'home' || activeSection === 'communities') && userData) {
      fetchFollowedCommunities();
    }
    if (activeSection === 'communities') {
      fetchAllCommunitiesData(1, searchTermRef.current || '');
      setCurrentPage(1);
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
  }, [activeSection, userData, selectedCommunityTab, language]);

  // Searching communities (debounce approach).
  // Keep this tied to the search input only so tab/section changes
  // don't issue a second duplicate request.
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (activeSection === 'communities') {
        fetchAllCommunitiesData(1, searchTerm);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    if (activeSection !== 'communities') return;
    fetchAllCommunitiesData(1, searchTerm);
    setCurrentPage(1);
  }, [communityFilter]);

  useEffect(() => {
    if (activeSection !== 'communities') return;
    fetchAllCommunitiesData(1, searchTerm);
    setCurrentPage(1);
  }, [communitySort]);

  // ---------------- URL SYNC (Communities only; visual state only) ----------------
  // Initialize local UI state from URL params on mount or when URL changes
  useEffect(() => {
    if (activeSection !== 'communities') return;
    const kind = (searchParams.get('kind') || '').toLowerCase();
    const scope = (searchParams.get('scope') || '').toLowerCase();
    const query = searchParams.get('query') ?? '';

    let didUpdate = false;
    if (kind === 'university' || kind === 'group') {
      if (selectedCommunityTab !== kind) {
        setSelectedCommunityTab(kind);
        didUpdate = true;
      }
    }
    if (['all', 'followed', 'unfollowed'].includes(scope)) {
      const scopeToState = scope === 'all' ? 'All' : scope.charAt(0).toUpperCase() + scope.slice(1);
      if (communityFilter !== scopeToState) {
        setCommunityFilter(scopeToState);
        didUpdate = true;
      }
    }
    if (typeof query === 'string' && searchTerm !== query) {
      setSearchTerm(query);
      didUpdate = true;
    }
    if (didUpdate) {
      skipUrlSyncRef.current = true;
    }
    // We intentionally do not trigger backend calls here. Existing effects handle fetching.
  }, [activeSection, searchParams]);

  // Push UI state to URL params when it changes (no backend calls triggered by this directly)
  useEffect(() => {
    if (activeSection !== 'communities') return;
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }
    const params = new URLSearchParams(searchParamsRef.current);

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

    if (changed) safeSetSearchParams(params, { replace: true });
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

  // Close explore dropdown when clicking outside
  useEffect(() => {
    if (!isExploreDropdownOpen) return undefined;
    const handleClickOutside = (event) => {
      if (exploreDropdownRef.current && !exploreDropdownRef.current.contains(event.target)) {
        setIsExploreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExploreDropdownOpen]);

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
    if (!isSuperAdminUser) {
      setNotification({ type: 'error', message: 'Only super admins can create forums.' });
      return;
    }
    setIsCreatingForum(true);
    // Info board community id (fixed)
    const infoCommunityId = 'c57b7fd6c45b9d57b';
    try {
      const payload = new FormData();
      payload.append('community_id', infoCommunityId);
      payload.append('name', newForumName);
      payload.append('description', newForumDescription);
      payload.append('tags', JSON.stringify(newForumTags));
      payload.append('image_layout', newForumImageLayout);
      if (newForumBannerFile) {
        payload.append('banner', newForumBannerFile);
      }
      const resp = await axios.post('/api/create_forum.php', payload);
      if (resp.data.success) {
        setNewForumName('');
        setNewForumDescription('');
        setNewForumTags([]);
        setNewForumBannerFile(null);
        setNewForumBannerPreview('');
        setNewForumImageLayout('banner');
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
    setNewForumTags([]);
    setNewForumBannerFile(null);
    setNewForumBannerPreview('');
    setNewForumImageLayout('banner');
    setIsCreatingForum(false);
  };

  // ------------- EDIT FORUM -------------
  const startEditingForum = (forum) => {
    setEditForumId(forum.forum_id);
    setEditForumName(forum.original_name ?? forum.name ?? '');
    setEditForumDescription(forum.original_description ?? forum.description ?? '');
    setEditForumTags(mapTagNamesToSlugs(forum.tags || [], tagOptions));
    setEditForumBannerFile(null);
    setEditForumBannerPreview(buildUploadSrc(forum.banner_path || '/uploads/banners/DefaultBanner.jpeg'));
    setEditForumImageLayout(normalizeImageLayout(forum.image_layout));
    setIsEditingForum(true);
  };

  const cancelEditingForum = () => {
    setEditForumId(null);
    setEditForumName('');
    setEditForumDescription('');
    setEditForumTags([]);
    setEditForumBannerFile(null);
    setEditForumBannerPreview('');
    setEditForumImageLayout('banner');
    setIsEditingForum(false);
  };

  const handleEditForumSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = new FormData();
      payload.append('forum_id', editForumId);
      payload.append('name', editForumName);
      payload.append('description', editForumDescription);
      payload.append('tags', JSON.stringify(editForumTags));
      payload.append('image_layout', editForumImageLayout);
      if (editForumBannerFile) {
        payload.append('banner', editForumBannerFile);
      }
      const resp = await axios.post('/api/edit_forum.php', payload);
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
      const endpoint = isSuperAdminUser ? '/api/create_community.php' : '/api/request_community.php';
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
      safeSetSearchParams(params, { replace: true });
    }
  }, [activeSection, searchParams, activeFeed, setActiveFeed, safeSetSearchParams]);

  const hasFeedForums = feedForums.length > 0;
  const hasFeedThreads = feedThreads.length > 0;
  const isFeedEmpty = !hasFeedForums && !hasFeedThreads;
  const isFeedSelectionEmpty = yourFeedView === 'forums' ? !hasFeedForums : !hasFeedThreads;

  const hasExploreForums = exploreForums.length > 0;
  const hasExploreThreads = exploreThreads.length > 0;
  const isExploreEmpty = !hasExploreForums && !hasExploreThreads;
  const isExploreSelectionEmpty = exploreView === 'forums' ? !hasExploreForums : !hasExploreThreads;

  // ------------- RENDER LOGIC -------------
  // HOME SECTION
  if (activeSection === 'home') {
    const homeDateLabel = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
    const homeVisibleCount =
      activeFeed === 'yourFeed'
        ? (yourFeedView === 'forums' ? feedForums.length : feedThreads.length)
        : (exploreView === 'forums' ? exploreForums.length : exploreThreads.length);
    const homeVisibleLabel =
      (activeFeed === 'yourFeed' ? yourFeedView : exploreView) === 'forums'
        ? t('home.forums')
        : t('home.threads');
    const homeViewDescription =
      activeFeed === 'yourFeed'
        ? t('home.feedDescription')
        : t('home.exploreDescription');
    const homeResultsMotionKey =
      activeFeed === 'yourFeed'
        ? `feed-${yourFeedView}-${feedSort}`
        : `explore-${exploreView}-${exploreTags.join('-') || 'all'}`;
    const homePathways = [
      {
        to: '/info',
        eyebrow: t('home.researchAnswers'),
        title: t('nav.infoBoard'),
        description: t('home.infoDescription'),
        Icon: BookOpenText,
        tone: 'info',
      },
      {
        to: '/communities',
        eyebrow: t('home.findCircle'),
        title: t('nav.communities'),
        description: t('home.communitiesDescription'),
        Icon: Users,
        tone: 'communities',
      },
      {
        to: '/events-feed',
        eyebrow: t('home.communityAgenda'),
        title: t('nav.events'),
        description: t('home.eventsDescription'),
        Icon: CalendarDays,
        tone: 'events',
      },
      userData
        ? {
            to: '/saved',
            eyebrow: t('home.yourCollection'),
            title: t('home.savedReading'),
            description: t('home.savedDescription'),
            Icon: Bookmark,
            tone: 'saved',
          }
        : {
            to: '/signup',
            eyebrow: t('home.joinCommons'),
            title: t('home.createProfile'),
            description: t('home.profileDescription'),
            Icon: LibraryBig,
            tone: 'profile',
          },
    ];
    const setHomeTab = (nextTab) => {
      if (nextTab === 'feed' && !userData) {
        onRequireAuth?.();
        return;
      }
      const params = new URLSearchParams(searchParams);
      if (params.get('tab') !== nextTab) {
        params.set('tab', nextTab);
        safeSetSearchParams(params);
      }
    };

    return withNotification(
      <main className="home-dashboard">
        {reportModal}
        <section className="home-hero" aria-labelledby="home-dashboard-title">
          <div className="home-hero-copy">
            <p className="home-kicker">
              <span>{t('nav.academicCommons')}</span>
              <span aria-hidden="true">•</span>
              {homeDateLabel}
            </p>
            <h1 id="home-dashboard-title">
              {userData?.first_name
                ? <>{t('home.welcomeBack')} <em>{userData.first_name}</em>.</>
                : <>{t('home.thoughtfulPlaceStart')} <em>{t('home.thoughtfulPlaceEmphasis')}</em>.</>}
            </h1>
            <p className="home-hero-description">
              {t('home.heroDescription')}
            </p>
          </div>
          <button
            type="button"
            className="home-button home-button-primary home-hero-cta"
            onClick={() => {
              setHomeTab('explore');
              const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
              homeReadingRoomRef.current?.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start',
              });
            }}
          >
            <Compass size={17} aria-hidden="true" />
            {t('home.explore')}
            <ArrowUpRight className="home-hero-cta-arrow" size={16} aria-hidden="true" />
          </button>
        </section>

        <nav className="home-pathways" aria-label={t('home.dashboardShortcuts')}>
          {homePathways.map(({ to, eyebrow, title, description, Icon, tone }) => (
            <Link key={to} to={to} className={`home-pathway-card home-pathway-card--${tone}`}>
              <span className="home-pathway-icon" aria-hidden="true">
                <Icon size={19} />
              </span>
              <span className="home-pathway-copy">
                <small>{eyebrow}</small>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <ArrowUpRight className="home-pathway-arrow" size={17} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <section className="home-reading-room" aria-labelledby="home-reading-room-title" ref={homeReadingRoomRef}>
          <header className="home-reading-room-header">
            <div>
              <p className="home-section-kicker">{t('home.discussionIndex')}</p>
              <h2 id="home-reading-room-title">
                {activeFeed === 'yourFeed' ? t('home.yourReadingRoom') : t('home.exploreCommons')}
              </h2>
              <p>{homeViewDescription}</p>
            </div>
            <div className="home-entry-count" aria-live="polite">
              <strong
                key={`${homeVisibleLabel}-${homeVisibleCount}`}
                className="home-entry-count-value"
              >
                {homeVisibleCount}
              </strong>
              <span>{t('home.inView', { label: homeVisibleLabel })}</span>
            </div>
          </header>

          <div className="section-controls home-controls filter-toolbar filter-toolbar--filter-first">
            <div className="control-group">
              <div
                ref={feedSegmentRef}
                className="chips-row segmented-control"
                style={{ '--seg-count': 2, '--seg-index': activeFeed === 'yourFeed' ? 0 : 1 }}
              >
                <button
                  type="button"
                  className={`chip your-feed-chip ${activeFeed === 'yourFeed' ? 'active' : ''} ${!userData ? 'chip-locked' : ''}`}
                  onClick={() => setHomeTab('feed')}
                  aria-disabled={!userData}
                  title={!userData ? t('home.logInForFeed') : t('home.viewFeed')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {!userData && <FaLock size={12} />}
                    {t('home.yourFeed')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`chip ${activeFeed === 'explore' ? 'active' : ''}`}
                  onClick={() => setHomeTab('explore')}
                >
                  {t('home.explore')}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="home-filter-trigger mobile-only"
              onClick={() => setShowHomeFilters((prev) => !prev)}
              aria-expanded={showHomeFilters}
              aria-controls="home-filter-panel"
              aria-label={showHomeFilters ? t('home.closeFilters') : t('home.openFilters')}
            >
              <FaFilter aria-hidden="true" />
            </button>
            <div
              id="home-filter-panel"
              className={`home-filter-panel ${showHomeFilters ? 'open' : ''}`}
            >
              <div className="control-group home-content-control">
                <span className="sort-pill">{t('home.content')}</span>
                {activeFeed === 'yourFeed' ? (
                  <div
                    ref={feedContentRef}
                    className="chips-row segmented-control"
                    style={{ '--seg-count': 2, '--seg-index': yourFeedView === 'forums' ? 0 : 1 }}
                  >
                    <button
                      type="button"
                      className={`chip ${yourFeedView === 'forums' ? 'active' : ''}`}
                      onClick={() => setYourFeedView('forums')}
                    >
                      {t('home.forumsTitle')}
                    </button>
                    <button
                      type="button"
                      className={`chip ${yourFeedView === 'threads' ? 'active' : ''}`}
                      onClick={() => setYourFeedView('threads')}
                    >
                      {t('home.threadsTitle')}
                    </button>
                  </div>
                ) : (
                  <div
                    ref={exploreContentRef}
                    className="chips-row segmented-control"
                    style={{ '--seg-count': 2, '--seg-index': exploreView === 'forums' ? 0 : 1 }}
                  >
                    <button
                      type="button"
                      className={`chip ${exploreView === 'forums' ? 'active' : ''}`}
                      onClick={() => setExploreView('forums')}
                    >
                      {t('home.forumsTitle')}
                    </button>
                    <button
                      type="button"
                      className={`chip ${exploreView === 'threads' ? 'active' : ''}`}
                      onClick={() => setExploreView('threads')}
                    >
                      {t('home.threadsTitle')}
                    </button>
                  </div>
                )}
              </div>
              {activeFeed === 'explore' && (
                <div className="control-group topic-multi-select-wrapper">
                  <span className="sort-pill">{t('home.tags')}</span>
                  <div className="topic-dropdown" ref={exploreDropdownRef}>
                    <button
                      type="button"
                      className={`topic-dropdown-toggle${isExploreDropdownOpen ? ' open' : ''}`}
                      onClick={() => setIsExploreDropdownOpen((open) => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={isExploreDropdownOpen}
                    >
                      <span ref={exploreLabelRef} className="topic-dropdown-label">{exploreLabelText}</span>
                    </button>
                    {isExploreDropdownOpen && (
                      <div className="topic-dropdown-menu" role="listbox" aria-multiselectable="true">
                        {exploreTagOptions.map((tagOption) => {
                          const checked = exploreTags.includes(tagOption.value);
                          return (
                            <label key={tagOption.value} className="topic-dropdown-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setExploreTags((prev) =>
                                    prev.includes(tagOption.value)
                                      ? prev.filter((t) => t !== tagOption.value)
                                      : [...prev, tagOption.value]
                                  );
                                }}
                              />
                              <span>{tagOption.label}</span>
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
                      onClick={clearExploreTags}
                      disabled={exploreTags.length === 0}
                    >
                      {t('home.clear')}
                    </button>
                  </div>
                </div>
              )}
              {activeFeed === 'yourFeed' && (
                <div className="control-group home-sort-control">
                  <label htmlFor="feed-sort" className="sort-pill">
                    {t('home.sort')}
                  </label>
                  <select
                    id="feed-sort"
                    className="sort-select"
                    value={feedSort}
                    onChange={(e) => setFeedSort(e.target.value)}
                  >
                    <option value="recent">{t('home.mostRecent')}</option>
                    <option value="trending">{t('home.trending')}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div key={homeResultsMotionKey} className="home-results-stage">
          {activeFeed === 'yourFeed' && userData ? (
            <>
              {isLoadingFeed ? (
                <div className="home-loading-state" aria-label={t('home.loadingFeed')}>
                  <span />
                  <span />
                  <span />
                </div>
              ) : isFeedEmpty ? (
                <div className="empty-feed-card">
                  <LibraryBig size={24} aria-hidden="true" />
                  <h3>{t('home.readingRoomReady')}</h3>
                  <p className="muted">
                    {hasInterests
                      ? t('home.followOrReturn')
                      : t('home.followOrInterests')}
                  </p>
                  {!hasInterests && (
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => {
                        navigate('/interest-selection');
                      }}
                    >
                      {t('home.chooseInterests')}
                    </button>
                  )}
                </div>
              ) : isFeedSelectionEmpty ? (
                <div className="empty-feed-card">
                  <BookOpenText size={24} aria-hidden="true" />
                  <h3>
                    {t('home.noItemsYet', {
                      label: yourFeedView === 'forums' ? t('home.forums') : t('home.threads'),
                    })}
                  </h3>
                  <p className="muted">
                    {t('home.switchToSeeMore', {
                      label: yourFeedView === 'forums' ? t('home.threadsTitle') : t('home.forumsTitle'),
                    })}
                  </p>
                </div>
              ) : (
                <>
                  {yourFeedView === 'forums' && hasFeedForums && (
                    <div className="home-discussion-list">
                      <div className="forum-list">
                        {feedForums.map((forum) => (
                          <ForumCard
                            key={forum.forum_id}
                            forum={forum}
                            userData={userData}
                            openMenuId={openMenuId}
                            toggleMenu={toggleMenu}
                            onReport={(f) =>
                              handleOpenReport({
                                id: f.forum_id,
                                type: 'forum',
                                label: f.original_name ?? f.name ?? 'forum',
                                context: stripHtml(f.original_description ?? f.description ?? f.original_name ?? f.name ?? '').slice(0, 200),
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
                    </div>
                  )}
                  {yourFeedView === 'threads' && hasFeedThreads && (
                    <div className="home-discussion-list home-thread-list">
                      {feedThreads.map((thread) => (
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
                              label: thread.original_title ?? thread.title ?? 'thread',
                              context: stripHtml(thread.original_title ?? thread.title ?? ''),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : activeFeed === 'explore' ? (
            <div className="explore-panel">
              {isLoadingExplore ? (
                <div className="home-loading-state" aria-label={t('home.loadingExplore')}>
                  <span />
                  <span />
                  <span />
                </div>
              ) : isExploreEmpty ? (
                <div className="empty-feed-card">
                  <Compass size={24} aria-hidden="true" />
                  <h3>{t('home.noDiscussionMatch')}</h3>
                  <p className="muted">
                    {t('home.clearOrTags')}
                  </p>
                  <button type="button" className="pill-button" onClick={clearExploreTags}>
                    {t('home.resetFilters')}
                  </button>
                </div>
              ) : isExploreSelectionEmpty ? (
                <div className="empty-feed-card">
                  <BookOpenText size={24} aria-hidden="true" />
                  <h3>
                    {t('home.noItemsFound', {
                      label: exploreView === 'forums' ? t('home.forums') : t('home.threads'),
                    })}
                  </h3>
                  <p className="muted">
                    {t('home.switchOrAdjust', {
                      label: exploreView === 'forums' ? t('home.threadsTitle') : t('home.forumsTitle'),
                    })}
                  </p>
                </div>
              ) : (
                <>
                  {exploreView === 'forums' && hasExploreForums && (
                    <div className="home-discussion-list">
                      <div className="forum-list">
                        {exploreForums.map((forum) => (
                          <ForumCard
                            key={forum.forum_id}
                            forum={forum}
                            userData={userData}
                            openMenuId={openMenuId}
                            toggleMenu={toggleMenu}
                            onReport={(f) =>
                              handleOpenReport({
                                id: f.forum_id,
                                type: 'forum',
                                label: f.original_name ?? f.name ?? 'forum',
                                context: stripHtml(f.original_description ?? f.description ?? f.original_name ?? f.name ?? '').slice(0, 200),
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
                    </div>
                  )}
                  {exploreView === 'threads' && hasExploreThreads && (
                    <div className="home-discussion-list home-thread-list">
                      {exploreThreads.map((thread) => (
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
                              label: thread.original_title ?? thread.title ?? 'thread',
                              context: stripHtml(thread.original_title ?? thread.title ?? ''),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="empty-feed-card">
              <LibraryBig size={24} aria-hidden="true" />
              <h3>{t('home.feedAfterJoin')}</h3>
              <p>{t('home.signInPersonalized')}</p>
              <button className="pill-button" type="button" onClick={() => navigate('/signup')}>
                {t('home.createAccount')}
              </button>
            </div>
          )}
          </div>
        </section>
      </main>
    );
  }

  // COMMUNITIES SECTION
  if (activeSection === 'communities') {
    return withNotification(
      <main className="scholarly-page scholarly-communities-page">
        {reportModal}
        <div className="feed-container scholarly-page-panel">
          <header className="scholarly-page-header">
            <div>
              <p className="scholarly-page-kicker">Find your circle</p>
              <h1>Communities</h1>
              <p>Discover university and group spaces organized around shared experience.</p>
            </div>
            <div className="scholarly-page-count" aria-live="polite">
              <strong>{isLoadingAll ? '—' : filteredCommunities.length}</strong>
              <span>communities in view</span>
            </div>
          </header>
          <div className="section-controls section-controls-sticky scholarly-controls community-controls filter-toolbar filter-toolbar--search-first">
            <div className="community-controls__primary">
              <label className="community-search-field" htmlFor="community-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search communities</span>
                <input
                  id="community-search"
                  type="search"
                  placeholder="Search universities and groups"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="community-filter-trigger mobile-only"
                onClick={() => setShowCommunityFilters((prev) => !prev)}
                aria-expanded={showCommunityFilters}
                aria-controls="community-filter-panel"
                aria-label="Open community filters and sort"
              >
                <FaFilter aria-hidden="true" />
              </button>
              {selectedCommunityTab === 'group' && (
                <div className="control-action">
                  <button
                    type="button"
                    className="pill-button community-request-button toolbar-primary-action"
                    onClick={openRequestCommunityModal}
                    aria-disabled={!userData}
                  >
                    {isSuperAdminUser ? '+ Create Group' : '+ Request Group'}
                  </button>
                </div>
              )}
            </div>

            <div
              id="community-filter-panel"
              className={`community-filter-panel community-controls__secondary ${showCommunityFilters ? 'open' : ''}`}
            >
              <div className="control-group">
                <span className="sort-pill">Type</span>
                <div
                  ref={communityTypeRef}
                  className="chips-row segmented-control"
                  style={{ '--seg-count': 2, '--seg-index': selectedCommunityTab === 'university' ? 0 : 1 }}
                >
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
                <span className="sort-pill">Following</span>
                <div
                  ref={communityFilterRef}
                  className="chips-row segmented-control"
                  style={{
                    '--seg-count': 3,
                    '--seg-index':
                      communityFilter === 'All' ? 0 : communityFilter === 'Followed' ? 1 : 2
                  }}
                >
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
              <div className="control-group community-sort-group">
                <label htmlFor="community-sort" className="sort-pill">
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
                  const universityFallbackLogo = buildUploadSrc('/uploads/logos/School Image.png');
                  const defaultCommunityLogo = buildUploadSrc('/uploads/logos/default-logo.png');
                  const fallbackLogo =
                    selectedCommunityTab === 'university'
                      ? universityFallbackLogo
                      : defaultCommunityLogo;
                  // The API resolves the best available logo into
                  // selected_logo_url: a verified local upload first, then a
                  // licensed remote logo. Prefer it, and treat the seeded
                  // default-logo.png as no logo rather than a real image.
                  const selectedLogo =
                    typeof community.selected_logo_url === 'string'
                      ? community.selected_logo_url.trim()
                      : '';
                  const normalizedLogoPath =
                    typeof community.logo_path === 'string' ? community.logo_path.trim() : '';
                  const isPlaceholderLogoPath =
                    /(^|\/)default-logo\.png$/i.test(normalizedLogoPath);
                  const logoSrc = selectedLogo
                    ? buildUploadSrc(selectedLogo)
                    : normalizedLogoPath && !isPlaceholderLogoPath
                      ? buildUploadSrc(normalizedLogoPath)
                      : fallbackLogo;
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
                        onError={(e) => {
                          const fallback = selectedCommunityTab === 'university'
                            ? universityFallbackLogo
                            : defaultCommunityLogo;
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                          }
                        }}
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
                          <span className="followers-count">
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
                      {/*
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
                      */}
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
              isSuperAdminUser && selectedCommunityTab === 'group'
                ? 'Create Group'
                : 'Request New Community'
            }
            submitLabel={isSuperAdminUser && selectedCommunityTab === 'group' ? 'Create' : 'Submit'}
            lockType={false}
            allowSubCommunity={isSuperAdminUser || adminCommunities.length > 0}
            parentCommunities={
              isSuperAdminUser ? allCommunitiesSimple : adminCommunities
            }
            isLoadingParents={
              isSuperAdminUser ? isLoadingAllParents : isLoadingAdminCommunities
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
      ? 'All tags'
      : selectedTopics
          .map((topic) => {
            const match = topicOptionsWithAll.find((opt) => opt.value === topic);
            return match ? match.label : topicLabelFromValue(topic);
          })
          .join(', ');

    return withNotification(
      <main className="scholarly-page scholarly-info-page">
        {reportModal}
        <div className="feed-container scholarly-page-panel">
          <header className="scholarly-page-header">
            <div>
              <p className="scholarly-page-kicker">Research & answers</p>
              <h1>Info Board</h1>
              <p>Questions, guides, and community knowledge organized for careful reading.</p>
            </div>
            <div className="scholarly-page-count" aria-live="polite">
              <strong>{isLoadingForums ? '—' : filteredForums.length}</strong>
              <span>forums in view</span>
            </div>
          </header>

          {/* Controls: Sort pill + topic chips */}
          <div className="section-controls info-controls section-controls-sticky scholarly-controls filter-toolbar filter-toolbar--filter-first">
            <div
              id="info-filter-panel"
              className="info-filter-panel control-group"
            >
              <span className="sort-pill">Tags</span>
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
            </div>
            <div className="control-group info-sort-group">
              <label htmlFor="sort-by" className="sort-pill">Sort</label>
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
            </div>

            {isSuperAdminUser && (
              <div className="control-action">
                <button
                  type="button"
                  className="pill-button community-request-button"
                  onClick={() => setShowCreateForumModal(true)}
                >
                  <span className="mobile-only">+</span>
                  <span className="desktop-only">+ New Forum</span>
                </button>
              </div>
            )}
          </div>

          {/* CREATE FORUM MODAL */}
          {showCreateForumModal && (
            <ModalOverlay
              isOpen={showCreateForumModal}
              onClose={handleDismissCreateForumModal}
              contentClassName="community-form-overlay"
            >
              <div className="creation-modal">
                <header className="creation-modal__header">
                  <p className="creation-modal__meta">Info Board</p>
                  <h3 className="creation-modal__title">New forum</h3>
                  <p className="creation-modal__sub">
                    A clear name and description help members instantly know if they&apos;re in the right place.
                  </p>
                </header>
                <form className="creation-fields" onSubmit={handleCreateForumSubmit}>
                  <div className="creation-field">
                    <label htmlFor="forum-name">
                      Name
                      <span className="creation-optional">
                        {newForumName.length} / {FORUM_TITLE_MAX_LENGTH}
                      </span>
                    </label>
                    <input
                      type="text"
                      id="forum-name"
                      value={newForumName}
                      placeholder="e.g. Financial aid questions"
                      onChange={(e) => setNewForumName(e.target.value)}
                      maxLength={FORUM_TITLE_MAX_LENGTH}
                      required
                    />
                  </div>
                  <div className="creation-field">
                    <label htmlFor="forum-description">Description</label>
                    <textarea
                      id="forum-description"
                      value={newForumDescription}
                      placeholder="What belongs here, and what doesn't?"
                      onChange={(e) => setNewForumDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="creation-field">
                    <TagPicker
                      label="Tags"
                      options={tagOptions}
                      value={newForumTags}
                      onChange={setNewForumTags}
                      max={5}
                      helperText="Choose up to 5 tags that describe this forum."
                    />
                  </div>
                  <div className="creation-field creation-media">
                    <label htmlFor="forum-banner">
                      Forum image <span className="creation-optional">optional</span>
                    </label>
                    <div className="creation-media__row">
                      <input
                        type="file"
                        id="forum-banner"
                        accept="image/png, image/jpeg"
                        onChange={(e) => setNewForumBannerFile(e.target.files?.[0] || null)}
                      />
                      <div className="creation-layout-toggle" role="radiogroup" aria-label="Image display">
                        <button
                          type="button"
                          className={newForumImageLayout === IMAGE_LAYOUTS.BANNER ? 'active' : ''}
                          aria-pressed={newForumImageLayout === IMAGE_LAYOUTS.BANNER}
                          onClick={() => setNewForumImageLayout(IMAGE_LAYOUTS.BANNER)}
                        >
                          Banner
                        </button>
                        <button
                          type="button"
                          className={newForumImageLayout === IMAGE_LAYOUTS.RIGHT ? 'active' : ''}
                          aria-pressed={newForumImageLayout === IMAGE_LAYOUTS.RIGHT}
                          onClick={() => setNewForumImageLayout(IMAGE_LAYOUTS.RIGHT)}
                        >
                          Right aligned
                        </button>
                        <button
                          type="button"
                          className={newForumImageLayout === IMAGE_LAYOUTS.FULL ? 'active' : ''}
                          aria-pressed={newForumImageLayout === IMAGE_LAYOUTS.FULL}
                          onClick={() => setNewForumImageLayout(IMAGE_LAYOUTS.FULL)}
                        >
                          Full size
                        </button>
                      </div>
                    </div>
                    {newForumBannerPreview && (
                      <img
                        src={newForumBannerPreview}
                        alt="Preview"
                        className={`creation-media__preview creation-media__preview--${normalizeImageLayout(newForumImageLayout)}`}
                      />
                    )}
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
                      {isCreatingForum ? 'Creating…' : 'Create forum'}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>
          )}

          {/* EDIT FORUM MODAL */}
          {isEditingForum && (
            <ModalOverlay
              isOpen={isEditingForum}
              onClose={cancelEditingForum}
              contentClassName="community-form-overlay"
            >
              <div className="creation-modal">
                <header className="creation-modal__header">
                  <p className="creation-modal__meta">Info Board</p>
                  <h3 className="creation-modal__title">Edit forum</h3>
                  <p className="creation-modal__sub">
                    Update the name, description, tags, or image for this forum.
                  </p>
                </header>
                <form className="creation-fields" onSubmit={handleEditForumSubmit}>
                  <div className="creation-field">
                    <label htmlFor="edit-forum-name">
                      Name
                      <span className="creation-optional">
                        {editForumName.length} / {FORUM_TITLE_MAX_LENGTH}
                      </span>
                    </label>
                    <input
                      type="text"
                      id="edit-forum-name"
                      value={editForumName}
                      onChange={(e) => setEditForumName(e.target.value)}
                      maxLength={FORUM_TITLE_MAX_LENGTH}
                      required
                    />
                  </div>
                  <div className="creation-field">
                    <label htmlFor="edit-forum-description">Description</label>
                    <textarea
                      id="edit-forum-description"
                      value={editForumDescription}
                      onChange={(e) => setEditForumDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="creation-field">
                    <TagPicker
                      label="Tags"
                      options={tagOptions}
                      value={editForumTags}
                      onChange={setEditForumTags}
                      max={5}
                      helperText="Update the tags for this forum."
                    />
                  </div>
                  <div className="creation-field creation-media">
                    <label htmlFor="edit-forum-banner">
                      Forum image <span className="creation-optional">optional</span>
                    </label>
                    <div className="creation-media__row">
                      <input
                        type="file"
                        id="edit-forum-banner"
                        accept="image/png, image/jpeg"
                        onChange={(e) => setEditForumBannerFile(e.target.files?.[0] || null)}
                      />
                      <div className="creation-layout-toggle" role="radiogroup" aria-label="Image display">
                        <button
                          type="button"
                          className={editForumImageLayout === IMAGE_LAYOUTS.BANNER ? 'active' : ''}
                          aria-pressed={editForumImageLayout === IMAGE_LAYOUTS.BANNER}
                          onClick={() => setEditForumImageLayout(IMAGE_LAYOUTS.BANNER)}
                        >
                          Banner
                        </button>
                        <button
                          type="button"
                          className={editForumImageLayout === IMAGE_LAYOUTS.RIGHT ? 'active' : ''}
                          aria-pressed={editForumImageLayout === IMAGE_LAYOUTS.RIGHT}
                          onClick={() => setEditForumImageLayout(IMAGE_LAYOUTS.RIGHT)}
                        >
                          Right aligned
                        </button>
                        <button
                          type="button"
                          className={editForumImageLayout === IMAGE_LAYOUTS.FULL ? 'active' : ''}
                          aria-pressed={editForumImageLayout === IMAGE_LAYOUTS.FULL}
                          onClick={() => setEditForumImageLayout(IMAGE_LAYOUTS.FULL)}
                        >
                          Full size
                        </button>
                      </div>
                    </div>
                    {editForumBannerPreview && (
                      <img
                        src={editForumBannerPreview}
                        alt="Preview"
                        className={`creation-media__preview creation-media__preview--${normalizeImageLayout(editForumImageLayout)}`}
                      />
                    )}
                  </div>
                  <div className="creation-actions">
                    <button type="button" className="creation-ghost" onClick={cancelEditingForum}>
                      Cancel
                    </button>
                    <button type="submit" className="creation-primary">
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>
          )}

          {isLoadingForums ? (
            <div className="info-board-state" role="status">Loading forums…</div>
          ) : filteredForums.length === 0 ? (
            <div className="info-board-state">
              {isAllTopicsSelected ? 'No forums available.' : 'No forums match these tags.'}
            </div>
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
                      label: f.original_name ?? f.name ?? 'forum',
                      context: stripHtml(f.original_description ?? f.description ?? f.original_name ?? f.name ?? '').slice(0, 200),
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
        {activeSection === 'home' && userData && (isSuperAdminUser || Number(userData.is_ambassador) === 1) && (
          <FloatingComposer
            communities={[...followedCommunities, ...allCommunities]}
          />
        )}
      </main>
    );
  }

  // FUNDING SECTION
  if (activeSection === 'funding') {
    const fundingPlans = [
      {
        title: 'Curated opportunities',
        description: 'A searchable catalog of scholarships and funding sources.',
        Icon: BadgeDollarSign,
      },
      {
        title: 'Eligibility & deadlines',
        description: 'Clear requirements, important dates, and school-based filters.',
        Icon: CalendarClock,
      },
      {
        title: 'Saved funding plans',
        description: 'A personal place to track opportunities and future reminders.',
        Icon: GraduationCap,
      },
    ];

    return withNotification(
      <main className="scholarly-page scholarly-funding-page">
        {reportModal}
        <section className="scholarly-funding-hero" aria-labelledby="funding-title">
          <div>
            <p className="scholarly-page-kicker">Funding archive</p>
            <h1 id="funding-title">A clearer path through education funding.</h1>
            <p>
              The funding hub is still in development. There are no live scholarship
              records or deadline tools here yet.
            </p>
            <div className="scholarly-page-actions">
              <Link className="home-button home-button-primary" to="/info?topics=financial-aid">
                Browse funding discussions
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link className="home-button scholarly-quiet-button" to="/home">
                Back to home
              </Link>
            </div>
          </div>
          <span className="scholarly-status-badge">Coming soon</span>
        </section>

        <section className="scholarly-funding-plan" aria-labelledby="funding-plan-title">
          <header>
            <div>
              <p className="scholarly-page-kicker">Planned archive</p>
              <h2 id="funding-plan-title">What this space is being designed to hold</h2>
            </div>
            <span>Planning, not live data</span>
          </header>
          <div className="scholarly-funding-grid">
            {fundingPlans.map(({ title, description, Icon }) => (
              <article key={title}>
                <span className="scholarly-funding-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <small>Planned</small>
              </article>
            ))}
          </div>
        </section>

        <aside className="scholarly-page-note">
          <BookOpenText size={19} aria-hidden="true" />
          <div>
            <strong>Funding conversations are available now.</strong>
            <p>
              Use the Info Board for current community discussions about financial aid,
              scholarships, and education costs.
            </p>
          </div>
          <Link to="/info?topics=financial-aid" aria-label="Open financial aid discussions">
            <ArrowUpRight size={18} />
          </Link>
        </aside>
      </main>
    );
  }

  // SAVED SECTION
  if (activeSection === 'saved' && userData) {
    const savedMetrics = [
      { key: 'forums', label: 'Forums', count: savedForums.length },
      { key: 'threads', label: 'Threads', count: savedThreads.length },
      { key: 'posts', label: 'Comments', count: savedPosts.length },
    ];
    const activeCount =
      savedTab === 'forums'
        ? savedForums.length
        : savedTab === 'threads'
          ? savedThreads.length
          : savedPosts.length;
    const savedQuery = savedSearch.trim().toLowerCase();
    const matchesSavedQuery = (...values) =>
      !savedQuery ||
      values
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(savedQuery);
    const filteredSavedForums = savedForums.filter((forum) =>
      matchesSavedQuery(forum.name, forum.description, forum.community_name)
    );
    const filteredSavedThreads = savedThreads.filter((thread) =>
      matchesSavedQuery(thread.title, thread.first_post_content, thread.forum_name)
    );
    const filteredSavedPosts = savedPosts.filter((post) =>
      matchesSavedQuery(post.content, post.original_post_content, post.thread_title, post.forum_name)
    );
    const activeResults =
      savedTab === 'forums'
        ? filteredSavedForums
        : savedTab === 'threads'
          ? filteredSavedThreads
          : filteredSavedPosts;

    return withNotification(
      <main className="scholarly-page scholarly-saved-page">
        {reportModal}
        <div className="feed-container scholarly-page-panel saved-page-panel">
          <header className="scholarly-page-header saved-page-header">
            <div>
              <p className="scholarly-page-kicker">Reading library</p>
              <h1>Saved</h1>
              <p>Return to the forums, threads, and comments you kept for later.</p>
            </div>
            <div className="scholarly-page-count saved-active-count" aria-live="polite">
              <strong>{activeResults.length}</strong>
              <span>saved {savedTab === 'posts' ? 'comments' : savedTab} in view</span>
            </div>
          </header>

          <div className="saved-section saved-page-body">
            <div className="saved-library-controls section-controls scholarly-controls filter-toolbar filter-toolbar--filter-first">
              <div
                ref={savedSegmentRef}
                className="saved-metrics admin-review__filters chips-row segmented-control"
                style={{
                  '--seg-count': savedMetrics.length,
                  '--seg-index': savedMetrics.findIndex((metric) => metric.key === savedTab)
                }}
                role="tablist"
                aria-label="Saved content types"
              >
                {savedMetrics.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    className={`chip saved-metric ${savedTab === metric.key ? 'active' : ''}`}
                    onClick={() => {
                      setSavedTab(metric.key);
                      setOpenSavedMenu(null);
                    }}
                    role="tab"
                    aria-selected={savedTab === metric.key}
                  >
                    <span className="saved-metric__label">{metric.label}</span>
                    <span className="saved-metric__value">{metric.count}</span>
                  </button>
                ))}
              </div>

              <label className="saved-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search saved items</span>
                <input
                  type="search"
                  value={savedSearch}
                  onChange={(event) => {
                    setSavedSearch(event.target.value);
                    setOpenSavedMenu(null);
                  }}
                  placeholder={`Search saved ${savedTab === 'posts' ? 'comments' : savedTab}`}
                />
                {savedQuery && <span>{activeResults.length} found</span>}
              </label>
            </div>

            {activeCount === 0 && (
              <div className="saved-empty">
                <h3>No saved {savedTab === 'posts' ? 'comments' : savedTab} yet</h3>
                <p>Save content from menus to build your quick-access library.</p>
              </div>
            )}

            {activeCount > 0 && activeResults.length === 0 && (
              <div className="saved-empty saved-search-empty">
                <h3>No matching saved items</h3>
                <p>Try a title, community, forum, or phrase from the content.</p>
              </div>
            )}

            {savedTab === 'forums' && filteredSavedForums.length > 0 && (
              <div className="saved-grid">
                {filteredSavedForums.map((f) => {
                  const menuKey = `forum-${f.forum_id}`;
                  return (
                  <article key={f.forum_id} className="saved-card">
                    <div className="saved-card__meta">
                      <span className="saved-card__type">Forum</span>
                      {f.saved_at && <span className="saved-card__time">Saved {formatSavedAt(f.saved_at)}</span>}
                    </div>
                    <div className="saved-card__crumbs">
                      <span>{f.community_name || 'Community'}</span>
                      <div className="saved-card__menu">
                          <button
                            type="button"
                            className="saved-card__menu-trigger"
                            onClick={() => setOpenSavedMenu(openSavedMenu === menuKey ? null : menuKey)}
                            aria-label={`Actions for ${f.name}`}
                            aria-expanded={openSavedMenu === menuKey}
                          >
                            <MoreVertical size={17} aria-hidden="true" />
                          </button>
                          {openSavedMenu === menuKey && (
                            <div className="dropdown-menu saved-card__menu-popover">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  handleSaveForum(f.forum_id, true);
                                  setOpenSavedMenu(null);
                                }}
                              >
                                Unsave
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                    <Link className="saved-card__title" to={`/info/forum/${f.forum_id}`}>
                      <h3>{f.name}</h3>
                    </Link>
                    <p className="saved-card__text">
                      {summarizeWithEllipsis(f.description || '', SAVED_CARD_MAX_CHARS) || 'No description provided...'}
                    </p>
                  </article>
                  );
                })}
              </div>
            )}

            {savedTab === 'threads' && filteredSavedThreads.length > 0 && (
              <div className="saved-grid">
                {filteredSavedThreads.map((t) => {
                  const menuKey = `thread-${t.thread_id}`;
                  return (
                  <article key={t.thread_id} className="saved-card">
                    <div className="saved-card__meta">
                      <span className="saved-card__type">Thread</span>
                      {t.saved_at && <span className="saved-card__time">Saved {formatSavedAt(t.saved_at)}</span>}
                    </div>
                    <div className="saved-card__crumbs">
                      <span>Info Board</span>
                      <span className="saved-card__crumb-sep">/</span>
                      <span>{t.forum_name || 'Forum'}</span>
                      <span className="saved-card__crumb-sep">/</span>
                      <div className="saved-card__menu">
                          <button
                            type="button"
                            className="saved-card__menu-trigger"
                            onClick={() => setOpenSavedMenu(openSavedMenu === menuKey ? null : menuKey)}
                            aria-label={`Actions for ${t.title || 'saved thread'}`}
                            aria-expanded={openSavedMenu === menuKey}
                          >
                            <MoreVertical size={17} aria-hidden="true" />
                          </button>
                          {openSavedMenu === menuKey && (
                            <div className="dropdown-menu saved-card__menu-popover">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  handleUnsaveThread(t.thread_id);
                                  setOpenSavedMenu(null);
                                }}
                              >
                                Unsave
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                    <Link className="saved-card__title" to={`/info/forum/${t.forum_id || 0}/thread/${t.thread_id}`}>
                      <h3>{t.title || 'Untitled thread'}</h3>
                    </Link>
                    <p className="saved-card__text">
                      {summarizeWithEllipsis(t.first_post_content || '', SAVED_CARD_MAX_CHARS) || 'No thread preview available...'}
                    </p>
                  </article>
                  );
                })}
              </div>
            )}

            {savedTab === 'posts' && filteredSavedPosts.length > 0 && (
              <div className="saved-grid">
                {filteredSavedPosts.map((p) => (
                  <article
                    key={p.post_id}
                    className={`saved-card saved-card--post ${Number(p.verified) === 1 ? 'saved-card--verified' : ''}`}
                  >
                    {(() => {
                      const normalizedPostId = normalizeDisplayId(p.post_id);
                      const postTarget =
                        p.thread_id && normalizedPostId
                          ? `/info/forum/${p.forum_id || 0}/thread/${p.thread_id}?post_id=${encodeURIComponent(normalizedPostId)}#post-${encodeURIComponent(normalizedPostId)}`
                          : '';
                      return (
                        <>
                    <div className="saved-card__meta">
                      <span className="saved-card__type">Comment</span>
                      {p.saved_at && <span className="saved-card__time">Saved {formatSavedAt(p.saved_at)}</span>}
                    </div>
                    {Number(p.verified) === 1 && (
                      <span className="saved-card__verified">Verified Answer</span>
                    )}
                    <div className="saved-card__crumbs">
                      <span>Info Board</span>
                      <span className="saved-card__crumb-sep">/</span>
                      <span>{p.forum_name || 'Forum'}</span>
                      {p.thread_title && (
                        <>
                          <span className="saved-card__crumb-sep">/</span>
                          <span
                            className="saved-card__crumb-truncate"
                            title={p.thread_title}
                          >
                            {summarizeWithEllipsis(p.thread_title, SAVED_CARD_MAX_CHARS)}
                          </span>
                        </>
                      )}
                      <div className="saved-card__menu">
                          <button
                            type="button"
                            className="saved-card__menu-trigger"
                            onClick={() => {
                              const menuKey = `post-${p.post_id}`;
                              setOpenSavedMenu(openSavedMenu === menuKey ? null : menuKey);
                            }}
                            aria-label="Actions for saved comment"
                            aria-expanded={openSavedMenu === `post-${p.post_id}`}
                          >
                            <MoreVertical size={17} aria-hidden="true" />
                          </button>
                          {openSavedMenu === `post-${p.post_id}` && (
                            <div className="dropdown-menu saved-card__menu-popover">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  handleUnsavePost(p.post_id);
                                  setOpenSavedMenu(null);
                                }}
                              >
                                Unsave
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                    {(() => {
                      const originalPostText = stripHtml(p.original_post_content || '');
                      const headingText = summarizeWithEllipsis(originalPostText, SAVED_CARD_MAX_CHARS)
                        || summarizeWithEllipsis(p.thread_title || '', SAVED_CARD_MAX_CHARS)
                        || 'Saved Comment';
                      const headingTitle = originalPostText || p.thread_title || 'Saved Comment';

                      return (
                        <h3 className="saved-card__heading" title={headingTitle}>
                          {postTarget ? (
                            <Link className="saved-card__thread-link" to={postTarget}>
                              {headingText}
                            </Link>
                          ) : (
                            headingText
                          )}
                        </h3>
                      );
                    })()}
                    <p className="saved-card__text">
                      {summarizeWithEllipsis(p.content, SAVED_CARD_MAX_CHARS) || 'No preview available...'}
                    </p>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // If none of the above sections match, display fallback content (e.g., "connections", etc.)
  return withNotification(
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
    </main>
  );
}

export default Feed;
