// src/components/GroupProfile.js
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { FaLock, FaEllipsisV, FaSearch } from 'react-icons/fa';
import './GroupProfile.css';
import ModalOverlay from './ModalOverlay';
import ReportModal from './ReportModal';
import { buildAvatarSrc } from '../utils/avatar';
import buildUploadSrc from '../utils/uploads';
import { getAdjustedColor, getReadableTextColor } from '../utils/color';
import { isSuperAdmin } from '../constants/roles';
import RightRail from '../widgets/RightRail';
import useCommunityAccent from '../hooks/useCommunityAccent';
import { THREAD_TITLE_MAX_LENGTH } from '../utils/contentLimits';
import ReelGrid from './ReelGrid';

function GroupProfile({ userData, onRequireAuth }) {
  const { id } = useParams(); // group community id
  const communityId = String(id);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [subgroupSearch, setSubgroupSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('');
  const [editSecondaryColor, setEditSecondaryColor] = useState('');
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [openPostsMenuId, setOpenPostsMenuId] = useState(null);
  const [pinnedItems, setPinnedItems] = useState([]);
  const [isLoadingPinned, setIsLoadingPinned] = useState(false);
  const [pinnedError, setPinnedError] = useState('');
  const [unpinBusy, setUnpinBusy] = useState({});
  const [openPinnedMenuId, setOpenPinnedMenuId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [subcommunities, setSubcommunities] = useState([]);
  const [loadingSubcommunities, setLoadingSubcommunities] = useState(false);
  const [subcommunitiesError, setSubcommunitiesError] = useState('');
  const [childFollowBusy, setChildFollowBusy] = useState({});
  const hasSubcommunities = subcommunities.length > 0;

  useCommunityAccent(group?.primary_color, group?.secondary_color);

  const currentAmbassador = ambassadors.find((a) => String(a.user_id) === String(userData?.user_id));
  const viewerRole = (currentAmbassador?.community_role || '').toLowerCase() || 'viewer';
  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const isCommunityAdmin = viewerRole === 'admin';
  const canEditCommunity = Boolean(userData) && (isSuperAdminUser || isCommunityAdmin);
  const canRemoveAmbassador = Boolean(userData) && (isSuperAdminUser || isCommunityAdmin);
  const canPinToOverview = Array.isArray(userData?.ambassador_communities)
    && userData.ambassador_communities.some((c) => String(c?.community_id ?? c?.id ?? '') === String(id));
  const canUnpinFromCommunity = Array.isArray(userData?.ambassador_communities)
    && userData.ambassador_communities.some((c) => String(c?.community_id ?? c?.id ?? '') === String(id));

  const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    const ts = parsed.getTime();
    if (Number.isNaN(ts)) return '';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 3600) {
      const mins = Math.max(1, Math.floor(seconds / 60));
      return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    }
    if (seconds < 86400) {
      const hours = Math.max(1, Math.round(seconds / 3600));
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const intervals = [
      { label: 'year', secs: 31536000 },
      { label: 'month', secs: 2592000 },
      { label: 'week', secs: 604800 },
      { label: 'day', secs: 86400 },
    ];
    for (const it of intervals) {
      const count = Math.floor(seconds / it.secs);
      if (count >= 1) return `${count} ${it.label}${count > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
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
        setStatusMessage('Report submitted.');
        setReportTarget(null);
      } else {
        setStatusMessage(resp.data.error || 'Unable to submit report.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setStatusMessage('An error occurred while submitting the report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSavePinnedItem = async (item) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    const isThread = item?.item_type === 'thread';
    const payload = isThread
      ? { user_id: userData.user_id, thread_id: item.thread_id || item.item_id }
      : { user_id: userData.user_id, forum_id: item.forum_id || item.item_id };
    const url = isThread ? '/api/save_thread.php' : '/api/save_forum.php';
    try {
      const resp = await axios.post(url, payload, { withCredentials: true });
      if (resp.data.success) {
        setStatusMessage(isThread ? 'Thread saved.' : 'Forum saved.');
      } else {
        setStatusMessage(resp.data.error || 'Unable to save.');
      }
    } catch (error) {
      console.error('Error saving pinned item:', error);
      setStatusMessage('An error occurred while saving.');
    } finally {
      setOpenPinnedMenuId(null);
    }
  };

  // Fetch group details on mount (or when id changes)
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const params = new URLSearchParams();
        params.append('community_id', id);
        if (userData?.user_id) {
          params.append('user_id', userData.user_id);
        }
        const response = await axios.get(`/api/fetch_group.php?${params.toString()}`);
        if (response.data.success) {
          setGroup(response.data.group);
          setFollowersCount(response.data.group.followers_count || 0);
          setIsFollowing(Boolean(response.data.group.is_following));
          setEditName(response.data.group.name || '');
          setEditTagline(response.data.group.tagline || '');
          setEditLocation(response.data.group.location || '');
          setEditWebsite(response.data.group.website || '');
          setEditPrimaryColor(response.data.group.primary_color || '#2F80ED');
          setEditSecondaryColor(response.data.group.secondary_color || '#1D5FC4');
        } else {
          setError(response.data.error);
        }
      } catch (err) {
        setError('Error fetching group data');
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [id, userData?.user_id]);

  const fetchAmbassadors = async (withSpinner = false) => {
    if (withSpinner) {
      setLoadingAmbassadors(true);
      setErrorAmbassadors(null);
    }
    try {
      const response = await axios.get(`/api/fetch_ambassador_list.php?community_id=${id}`);
      if (response.data.success) {
        setAmbassadors(response.data.ambassadors || []);
      } else {
        setAmbassadors([]);
        setErrorAmbassadors(response.data.error || 'Unable to load ambassadors');
      }
    } catch (err) {
      setAmbassadors([]);
      setErrorAmbassadors('Unable to load ambassadors');
    } finally {
      if (withSpinner) {
        setLoadingAmbassadors(false);
      }
    }
  };

  useEffect(() => {
    fetchAmbassadors();
  }, [id]);

  useEffect(() => {
    const handleOpenAmbassadors = (event) => {
      if (String(event?.detail?.communityId || '') !== String(id) || !userData) return;
      setShowAmbassadorOverlay(true);
      setMenuOpenFor(null);
      fetchAmbassadors(true);
    };
    window.addEventListener('openCommunityAmbassadors', handleOpenAmbassadors);
    return () => window.removeEventListener('openCommunityAmbassadors', handleOpenAmbassadors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userData?.user_id]);

  const isLoggedIn = Boolean(userData);
  const isAmbassador =
    isLoggedIn &&
    ambassadors.some((a) => String(a.user_id || a.id) === String(userData.user_id));

  const getInitials = (firstName = '', lastName = '') => {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || 'A';
  };

  const loadQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const res = await axios.get(`/api/fetch_group_questions.php?group_id=${id}&viewer_id=${userData?.user_id || 0}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setQuestions(res.data.questions || []);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      setQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'qa') {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userData]);

  const loadSubcommunities = async () => {
    setLoadingSubcommunities(true);
    setSubcommunitiesError('');
    try {
      const params = new URLSearchParams();
      params.append('parent_id', id);
      if (userData?.user_id) {
        params.append('user_id', userData.user_id);
      }
      const res = await axios.get(`/api/fetch_subcommunities.php?${params.toString()}`);
      if (res.data.success) {
        setSubcommunities(res.data.subcommunities || []);
      } else {
        setSubcommunities([]);
        setSubcommunitiesError(res.data.error || 'Unable to load sub-communities.');
      }
    } catch (err) {
      setSubcommunities([]);
      setSubcommunitiesError('Unable to load sub-communities.');
    } finally {
      setLoadingSubcommunities(false);
    }
  };

  useEffect(() => {
    loadSubcommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userData?.user_id]);

  useEffect(() => {
    const fetchPinnedItems = async () => {
      setIsLoadingPinned(true);
      setPinnedError('');
      try {
        const res = await axios.get(`/api/fetch_pinned_items.php?community_id=${id}`);
        if (res.data.success) {
          setPinnedItems(Array.isArray(res.data.items) ? res.data.items : []);
        } else {
          setPinnedItems([]);
          setPinnedError(res.data.error || 'Unable to load pinned items.');
        }
      } catch (err) {
        setPinnedItems([]);
        setPinnedError('Unable to load pinned items.');
      } finally {
        setIsLoadingPinned(false);
      }
    };

    fetchPinnedItems();
  }, [id]);

  const handleUnpin = async (pinId) => {
    if (!canUnpinFromCommunity || !pinId) return;
    setOpenPinnedMenuId(null);
    setUnpinBusy((prev) => ({ ...prev, [pinId]: true }));
    try {
      const res = await axios.post(
        '/api/unpin_from_community.php',
        { pin_id: pinId },
        { withCredentials: true }
      );
      if (res.data.success) {
        setPinnedItems((prev) => prev.filter((item) => String(item.pin_id) !== String(pinId)));
      } else {
        alert(res.data.error || 'Unable to un-pin this item.');
      }
    } catch (err) {
      alert('Unable to un-pin this item.');
    } finally {
      setUnpinBusy((prev) => {
        const next = { ...prev };
        delete next[pinId];
        return next;
      });
    }
  };

  const refreshGroupPosts = async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const forumsRes = await axios.get(`/api/fetch_forums.php?community_id=${id}`);
      const forumsList = Array.isArray(forumsRes.data?.forums)
        ? forumsRes.data.forums
        : Array.isArray(forumsRes.data)
        ? forumsRes.data
        : [];
      if (!forumsList.length) {
        setPosts([]);
        return;
      }

      const threadsPromises = forumsList.map(async (forum) => {
        const tRes = await axios.get(
          `/api/fetch_threads.php?forum_id=${forum.forum_id}&user_id=${userData?.user_id || ''}`
        );
        const threads = Array.isArray(tRes.data) ? tRes.data : [];
        return threads.map((t) => ({ ...t, forum_name: forum.name }));
      });
      const threadGroups = await Promise.all(threadsPromises);
      const allThreads = threadGroups.flat();
      allThreads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPosts(allThreads);
    } catch (err) {
      setPostsError('Unable to load posts.');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  const handlePinThreadToOverview = async (thread) => {
    if (!canPinToOverview) return;
    try {
      const res = await axios.post(
        '/api/pin_to_community.php',
        {
          community_id: id,
          item_id: thread.thread_id,
          item_type: 'thread',
        },
        { withCredentials: true }
      );
      if (!res.data.success) {
        alert(res.data.error || 'Unable to pin thread.');
        return;
      }
      const pinnedRes = await axios.get(`/api/fetch_pinned_items.php?community_id=${id}`);
      if (pinnedRes.data.success) {
        setPinnedItems(Array.isArray(pinnedRes.data.items) ? pinnedRes.data.items : []);
      }
      setOpenPostsMenuId(null);
    } catch (err) {
      alert('Unable to pin thread.');
    }
  };

  const handleEditThreadFromPosts = async (thread) => {
    const canManage = isSuperAdminUser || isCommunityAdmin || String(thread.user_id) === String(userData?.user_id);
    if (!canManage) return;
    const nextTitle = window.prompt('Edit thread title:', thread.title || '');
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) {
      alert('Title cannot be empty.');
      return;
    }
    if (trimmed.length > THREAD_TITLE_MAX_LENGTH) {
      alert(`Thread titles must be ${THREAD_TITLE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    try {
      const res = await axios.post(
        '/api/edit_thread.php',
        { thread_id: thread.thread_id, new_title: trimmed },
        { withCredentials: true }
      );
      if (!res.data.success) {
        alert(res.data.error || 'Unable to edit thread.');
        return;
      }
      await refreshGroupPosts();
      setOpenPostsMenuId(null);
    } catch (err) {
      alert('Unable to edit thread.');
    }
  };

  const handleDeleteThreadFromPosts = async (thread) => {
    const canManage = isSuperAdminUser || isCommunityAdmin || String(thread.user_id) === String(userData?.user_id);
    if (!canManage) return;
    if (!window.confirm('Delete this thread? This cannot be undone.')) return;
    try {
      const res = await axios.post(
        '/api/delete_thread.php',
        { thread_id: thread.thread_id },
        { withCredentials: true }
      );
      if (!res.data.success) {
        alert(res.data.error || 'Unable to delete thread.');
        return;
      }
      await refreshGroupPosts();
      setOpenPostsMenuId(null);
    } catch (err) {
      alert('Unable to delete thread.');
    }
  };

  useEffect(() => {
    if (!openPinnedMenuId) return undefined;
    const handleClickOutside = (event) => {
      if (event.target.closest('.pinned-menu-container')) return;
      setOpenPinnedMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [openPinnedMenuId]);

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    setIsSubmittingQuestion(true);
    try {
      const res = await axios.post(
        '/api/submit_group_question.php',
        {
          group_id: id,
          user_id: userData.user_id,
          title: questionTitle,
          body: questionBody,
        },
        { withCredentials: true }
      );
      if (res.data.success) {
        setQuestionTitle('');
        setQuestionBody('');
        setStatusMessage('Question submitted for review.');
        loadQuestions();
        setShowQuestionModal(false);
      } else {
        setStatusMessage(res.data.error || 'Unable to submit question.');
      }
    } catch (err) {
      setStatusMessage('Unable to submit question.');
    } finally {
      setIsSubmittingQuestion(false);
      setTimeout(() => setStatusMessage(''), 2500);
    }
  };

  const handleApproveQuestion = async (questionId) => {
    if (!isAmbassador) return;
    try {
      const res = await axios.post(
        '/api/approve_group_question.php',
        { question_id: questionId, user_id: userData.user_id },
        { withCredentials: true }
      );
      if (res.data.success) {
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleSubmitAnswer = async (questionId) => {
    if (!isAmbassador) return;
    const body = answerDrafts[questionId] || '';
    if (!body.trim()) return;
    try {
      const res = await axios.post(
        '/api/answer_group_question.php',
        { question_id: questionId, ambassador_id: userData.user_id, body },
        { withCredentials: true }
      );
      if (res.data.success) {
        setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleRejectQuestion = async (questionId, reason) => {
    if (!isAmbassador) return;
    try {
      const res = await axios.post(
        '/api/reject_group_question.php',
        { question_id: questionId, user_id: userData.user_id, reason },
        { withCredentials: true }
      );
      if (res.data.success) {
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleFollowToggle = async () => {
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    setIsTogglingFollow(true);
    try {
      const endpoint = isFollowing ? '/api/unfollow_community.php' : '/api/follow_community.php';
      const res = await axios.post(
        endpoint,
        { user_id: userData.user_id, community_id: id },
        { withCredentials: true }
      );
      if (res.data.error) {
        alert(res.data.error);
        return;
      }
      setIsFollowing(!isFollowing);
      setFollowersCount((prev) => Math.max(0, prev + (isFollowing ? -1 : 1)));
    } catch (err) {
      console.error('Error updating follow status:', err);
      alert('Unable to update follow status right now.');
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleChildFollowToggle = async (communityId, isFollowingNow) => {
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    setChildFollowBusy((prev) => ({ ...prev, [communityId]: true }));
    try {
      const endpoint = isFollowingNow ? '/api/unfollow_community.php' : '/api/follow_community.php';
      const res = await axios.post(
        endpoint,
        { user_id: userData.user_id, community_id: communityId },
        { withCredentials: true }
      );
      if (res.data.error) {
        alert(res.data.error);
        return;
      }
      setSubcommunities((prev) =>
        prev.map((c) => {
          if (String(c.community_id) !== String(communityId)) return c;
          const nextFollowers = Number(c.followers_count || 0) + (isFollowingNow ? -1 : 1);
          return {
            ...c,
            is_following: !isFollowingNow,
            followers_count: Math.max(0, nextFollowers)
          };
        })
      );
    } catch (err) {
      console.error('Error updating follow status:', err);
      alert('Unable to update follow status right now.');
    } finally {
      setChildFollowBusy((prev) => {
        const next = { ...prev };
        delete next[communityId];
        return next;
      });
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!group) return <p>No group found.</p>;

  const openEdit = () => {
    if (!canEditCommunity) return;
    setEditStatus('');
    setNewLogoFile(null);
    setNewBannerFile(null);
    setEditName(group.name || '');
    setEditTagline(group.tagline || '');
    setEditLocation(group.location || '');
    setEditWebsite(group.website || '');
    setEditPrimaryColor(group.primary_color || '#2F80ED');
    setEditSecondaryColor(group.secondary_color || '#1D5FC4');
    setShowEditModal(true);
  };

  const handleRemoveAmbassador = async (amb) => {
    if (!canRemoveAmbassador || String(amb.community_role).toLowerCase() === 'admin') return;
    const reason = window.prompt('Are you sure you want to revoke their access? Provide a reason (optional):', '');
    if (reason === null) return;
    try {
      await axios.post(
        '/api/remove_ambassador.php',
        { community_id: id, user_id: amb.user_id, reason },
        { withCredentials: true }
      );
      fetchAmbassadors(true);
    } catch (err) {
      alert('Unable to remove ambassador right now.');
    }
  };

  const handlePromoteToAdmin = async (amb) => {
    if (!canEditCommunity || String(amb.community_role).toLowerCase() === 'admin') return;
    try {
      await axios.post(
        '/api/promote_user_to_admin.php',
        { community_id: id, user_id: amb.user_id },
        { withCredentials: true }
      );
      fetchAmbassadors(true);
    } catch (err) {
      alert('Unable to promote to admin right now.');
    }
  };

  const handleUpdateCommunity = async (e) => {
    e?.preventDefault();
    if (!canEditCommunity) return;
    setIsSavingEdit(true);
    setEditStatus('');
    const formData = new FormData();
    formData.append('community_id', communityId);
    formData.append('name', editName);
    formData.append('tagline', editTagline);
    formData.append('location', editLocation);
    formData.append('website', editWebsite);
    formData.append('primary_color', editPrimaryColor);
    formData.append('secondary_color', editSecondaryColor);
    if (newLogoFile) formData.append('logo', newLogoFile);
    if (newBannerFile) formData.append('banner', newBannerFile);
    try {
      const res = await axios.post('/api/update_university.php', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = (() => {
        if (typeof res.data === 'string') {
          try {
            return JSON.parse(res.data);
          } catch {
            return {};
          }
        }
        return res.data || {};
      })();

      if (payload.success) {
        const updated = payload.university || payload.group || payload.community || null;
        if (updated) {
          setGroup(updated);
          setEditStatus('Community updated successfully.');
          setShowEditModal(false);
        } else {
          setEditStatus('Updated, but no data returned. Please refresh.');
        }
      } else {
        setEditStatus(payload.error || 'Unable to update community.');
      }
    } catch (err) {
      setEditStatus('An error occurred while updating.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const logoSrc = buildUploadSrc(group.logo_path || '/uploads/logos/default-logo.png');
  const primaryColor = group.primary_color || '#2F80ED';
  const secondaryColor = group.secondary_color || '#1D5FC4';
  const gradientLight = getAdjustedColor(primaryColor, 1.12);
  const gradientDark = getAdjustedColor(primaryColor, 0.85);
  const pillTextColor = getReadableTextColor(primaryColor);
  const subgroupQuery = subgroupSearch.trim().toLowerCase();
  const questionQuery = questionSearch.trim().toLowerCase();
  const visibleSubcommunities = subgroupQuery
    ? subcommunities.filter((child) => (
        [child.name, child.tagline, child.location, child.community_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(subgroupQuery))
      ))
    : subcommunities;
  const visibleQuestions = questionQuery
    ? questions.filter((question) => (
        [
          question.title,
          question.body,
          question.asker_first_name,
          question.asker_last_name,
          ...(Array.isArray(question.answers)
            ? question.answers.flatMap((answer) => [answer.body, answer.first_name, answer.last_name])
            : []),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(questionQuery))
      ))
    : questions;

  return (
    <div
      className="profile-container community-profile"
      style={{
        '--primary-color': primaryColor,
        '--secondary-color': secondaryColor,
        ...(gradientLight ? { '--gradient-secondary-light': gradientLight } : {}),
        ...(gradientDark ? { '--gradient-secondary-dark': gradientDark } : {}),
        ...(pillTextColor ? { '--pill-text-color': pillTextColor } : {})
      }}
    >
      <section className="profile-main">
        {/* HERO CARD */}
        <div className="hero-card community-hero">
          <div className="hero-banner">
            <img
              src={buildUploadSrc(group.banner_path || '/uploads/banners/DefaultBanner.jpeg')}
              alt="Group Banner"
            />
          </div>
          <div className="hero-content">
            <div className="hero-left">
              <div className="community-hero-logo-wrap">
                <img src={logoSrc || '/uploads/logos/default-logo.png'} alt="Group Logo" className="community-hero-logo" />
              </div>
              <div className="hero-text">
                <h1 className="hero-title">{group.name}</h1>
                {group.parent_name && group.parent_community_id && (
                  <p className="hero-sub" style={{ marginTop: 4 }}>
                    Part of{' '}
                    <RouterLink
                      to={`/${group.parent_type || 'university'}/${group.parent_community_id}`}
                      style={{ color: 'inherit', fontWeight: 600 }}
                    >
                      {group.parent_name}
                    </RouterLink>
                  </p>
                )}
                {group.tagline && <p className="hero-sub">{group.tagline}</p>}
                {group.location && <p className="hero-sub">{group.location}</p>}
                <p className="hero-sub hero-sub-row">
                  <span>{followersCount} follower{followersCount === 1 ? '' : 's'}</span>
                  {typeof group.child_count !== 'undefined' && (
                    <span>
                      {group.child_count} {Number(group.child_count) === 1 ? 'sub-community' : 'sub-communities'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="hero-right hero-actions">
              <button
                type="button"
                className={`pill-button ${isFollowing ? 'secondary' : ''} ${!isLoggedIn ? 'locked' : ''}`}
                onClick={handleFollowToggle}
                aria-disabled={!isLoggedIn || isTogglingFollow}
                disabled={isTogglingFollow}
                title={!isLoggedIn ? 'Log in to follow this group' : isFollowing ? 'Unfollow this group' : 'Follow this group'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!isLoggedIn && <FaLock size={12} />}
                  {isTogglingFollow ? 'Updating…' : isFollowing ? 'Unfollow' : 'Follow'}
                </span>
              </button>
              {canEditCommunity && (
                <button
                  type="button"
                  className="pill-button secondary"
                  title="Edit this community"
                  onClick={openEdit}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          <div className="tabs-underline">
            <button
              type="button"
              className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            {(hasSubcommunities || isLoggedIn) && (
              <button
                type="button"
                className={`tab-link ${activeTab === 'subgroups' ? 'active' : ''}`}
                onClick={() => setActiveTab('subgroups')}
              >
                Sub-Groups
              </button>
            )}
            <button
              type="button"
              className={`tab-link ${activeTab === 'qa' ? 'active' : ''}`}
              onClick={() => setActiveTab('qa')}
            >
              Q+A
            </button>
            <button
              type="button"
              className={`tab-link ${activeTab === 'reels' ? 'active' : ''}`}
              onClick={() => setActiveTab('reels')}
            >
              Reels
            </button>
            <button
              type="button"
              className={`tab-link community-mobile-tab ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Events
            </button>
            <button
              type="button"
              className={`tab-link community-mobile-tab ${activeTab === 'polls' ? 'active' : ''}`}
              onClick={() => setActiveTab('polls')}
            >
              Polls
            </button>
            <button
              type="button"
              className={`tab-link community-mobile-tab ${activeTab === 'contact' ? 'active' : ''}`}
              onClick={() => setActiveTab('contact')}
            >
              Contact
            </button>
            <button
              type="button"
              className={`tab-link ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Pinned Topics
            </button>
          </div>
        </div>

        <div className="community-profile-content">
          <div className="split-main">
            {activeTab === 'overview' && (
              <div className="content-card community-overview-card">
                <div className="qa-header">
                  <div>
                    <h3>Overview</h3>
                    <p className="muted">About {group.name}.</p>
                  </div>
                </div>
                {group.tagline ? (
                  <p className="community-overview__lead">{group.tagline}</p>
                ) : (
                  <p className="muted">This group has not added an introduction yet.</p>
                )}
                <dl className="community-overview__facts">
                  <div>
                    <dt>Type</dt>
                    <dd>{group.parent_community_id ? 'Sub-Group' : 'Group'}</dd>
                  </div>
                  {group.parent_name && (
                    <div>
                      <dt>Part of</dt>
                      <dd>{group.parent_name}</dd>
                    </div>
                  )}
                  {group.location && (
                    <div>
                      <dt>Location</dt>
                      <dd>{group.location}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Community</dt>
                    <dd>{followersCount} follower{followersCount === 1 ? '' : 's'}</dd>
                  </div>
                  {group.website && (
                    <div>
                      <dt>Website</dt>
                      <dd>
                        <a href={group.website} target="_blank" rel="noreferrer">
                          Visit website
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {activeTab === 'reels' && (
              <ReelGrid
                communityId={communityId}
                isOwner={isFollowing || canEditCommunity || canPinToOverview}
                showCreate={isLoggedIn && (isFollowing || canEditCommunity || canPinToOverview)}
                title={`${group.name} Reels`}
                description={`Short videos shared with the ${group.name} community.`}
                emptyLabel="No community reels have been shared yet."
              />
            )}

            {activeTab === 'posts' && (
              <div className="content-card community-pinned-card">
                <div className="qa-header">
                  <div>
                    <h3>Pinned Topics</h3>
                    <p className="muted">Ambassador-picked threads and forums for {group.name}.</p>
                  </div>
                </div>
                {isLoadingPinned ? (
                  <p>Loading pinned items...</p>
                ) : pinnedError ? (
                  <p>{pinnedError}</p>
                ) : pinnedItems.length === 0 ? (
                  <p className="muted">No pinned threads or forums yet.</p>
                ) : (
                  <div className="posts-list pinned-topic-list">
                    {pinnedItems.map((item) => {
                      const isThread = item.item_type === 'thread';
                      const threadId = item.thread_id || item.item_id;
                      const forumId = item.forum_id;
                      const href = isThread
                        ? `/info/forum/${forumId}/thread/${threadId}`
                        : `/info/forum/${forumId}`;
                      const canShowPinnedMenu = Boolean(userData);
                      return (
                        <article
                          key={item.pin_id || `${item.item_type}:${item.item_id}`}
                          className={`forum-card pinned-topic-card pinned-topic-card--${isThread ? 'thread' : 'forum'}`}
                        >
                          {canShowPinnedMenu ? (
                            <div className="pinned-menu-container" style={{ position: 'absolute', right: 10, top: 10, zIndex: 10000 }}>
                              <button
                                type="button"
                                className="kebab-button"
                                aria-haspopup="menu"
                                aria-expanded={openPinnedMenuId === item.pin_id}
                                onClick={() =>
                                  setOpenPinnedMenuId((prev) => (prev === item.pin_id ? null : item.pin_id))
                                }
                              >
                                <FaEllipsisV />
                              </button>
                              {openPinnedMenuId === item.pin_id && (
                                <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 26, zIndex: 10001 }}>
                                  {canUnpinFromCommunity && item.pin_id ? (
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => handleUnpin(item.pin_id)}
                                      disabled={Boolean(unpinBusy[item.pin_id])}
                                    >
                                      {unpinBusy[item.pin_id] ? 'Un-pinning...' : 'Un-pin from Community'}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => handleSavePinnedItem(item)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => {
                                      const targetId = isThread ? threadId : forumId;
                                      handleOpenReport({
                                        id: targetId,
                                        type: isThread ? 'thread' : 'forum',
                                        label: item.title || (isThread ? 'thread' : 'forum'),
                                        context: stripHtml(item.description || item.title || '').slice(0, 200),
                                      });
                                      setOpenPinnedMenuId(null);
                                    }}
                                  >
                                    Report
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                          <div className="meta-row" style={{ marginBottom: '4px' }}>
                            <span className="meta-quiet">{isThread ? 'Thread' : 'Forum'}</span>
                            <span className="middot">·</span>
                            <span className="meta-quiet">Pinned {timeAgo(item.pinned_at)}</span>
                          </div>
                          <h4 style={{ margin: 0 }}>
                            <RouterLink to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {item.title}
                            </RouterLink>
                          </h4>
                          {isThread && item.forum_name ? (
                            <p className="pinned-topic-card__context">{item.forum_name}</p>
                          ) : item.description ? (
                            <p className="pinned-topic-card__summary">
                              {stripHtml(item.description).slice(0, 180)}
                              {stripHtml(item.description).length > 180 ? '…' : ''}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subgroups' && (
              <div className="content-card community-subgroups-card">
                <div className="qa-header">
                  <div>
                    <h3>Sub-Groups</h3>
                    <p className="muted">Teams or programs inside {group.name}.</p>
                  </div>
                </div>
                <div className="community-tab-search">
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={subgroupSearch}
                    onChange={(event) => setSubgroupSearch(event.target.value)}
                    placeholder="Search sub-groups"
                    aria-label="Search sub-groups"
                  />
                  {subgroupSearch && (
                    <button type="button" onClick={() => setSubgroupSearch('')} aria-label="Clear sub-group search">
                      ×
                    </button>
                  )}
                </div>
                {loadingSubcommunities ? (
                  <p>Loading sub-groups...</p>
                ) : subcommunitiesError ? (
                  <p>{subcommunitiesError}</p>
                ) : subcommunities.length === 0 ? (
                  <p className="muted">No sub-groups yet.</p>
                ) : visibleSubcommunities.length === 0 ? (
                  <p className="community-tab-empty">No sub-groups match “{subgroupSearch}”.</p>
                ) : (
                  <div className="community-list community-subgroup-list">
                    {visibleSubcommunities.map((child) => {
                      const isFollowingChild =
                        child.is_following === true ||
                        child.is_following === 1 ||
                        child.is_following === '1';
                          const logoSrc = buildUploadSrc(child.logo_path || '/uploads/logos/default-logo.png');
                      return (
                        <div
                          key={child.community_id}
                          className={`community-row-card community-subgroup-card${isFollowingChild ? ' followed' : ''}`}
                        >
                          <img
                            src={logoSrc}
                            alt={`${child.name} Logo`}
                            className="community-row-logo"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = buildUploadSrc('/uploads/logos/School Image.png');
                            }}
                          />
                          <div className="community-row-content">
                            <div className="community-row-header">
                              <h4 className="community-name" style={{ margin: 0 }}>
                                <RouterLink
                                  to={`/${child.community_type}/${child.community_id}`}
                                  style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                  <span className="truncate-38ch">{child.name}</span>
                                </RouterLink>
                              </h4>
                              <span className="community-subgroup-type">
                                {child.community_type === 'group' ? 'Group' : 'University'}
                              </span>
                            </div>
                            {child.tagline && (
                              <p className="community-slogan" style={{ margin: '2px 0' }}>{child.tagline}</p>
                            )}
                            <div className="community-row-meta">
                              {child.location && (
                                <span className="community-location">{child.location}</span>
                              )}
                              <span className="followers-count">
                                {child.followers_count || 0} follower{Number(child.followers_count || 0) === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                          <div className="community-row-actions">
                            <button
                              type="button"
                              className={`follow-button ${isFollowingChild ? 'unfollow' : 'follow'} ${!isLoggedIn ? 'locked' : ''}`}
                              onClick={() => handleChildFollowToggle(child.community_id, isFollowingChild)}
                              aria-disabled={!isLoggedIn || childFollowBusy[child.community_id]}
                              disabled={childFollowBusy[child.community_id]}
                              title={!isLoggedIn ? 'Log in to follow communities' : isFollowingChild ? 'Unfollow community' : 'Follow community'}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {!isLoggedIn && <FaLock size={12} />}
                                {childFollowBusy[child.community_id]
                                  ? 'Updating…'
                                  : isFollowingChild
                                  ? 'Unfollow'
                                  : 'Follow'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {false && activeTab === 'posts' && (
              <div className="content-card">
                <div className="qa-header">
                  <div>
                    <h3>Recent Topics</h3>
                    <p className="muted">Recent conversations from {group.name}.</p>
                  </div>
                </div>
                <div className="posts-list">
                  {postsLoading ? (
                    <p>Loading posts...</p>
                  ) : postsError ? (
                    <p>{postsError}</p>
                  ) : posts.length === 0 ? (
                    <p>No posts yet.</p>
                  ) : (
                    posts.map((p) => (
                      <div key={p.thread_id} className="forum-card card-lift" style={{ marginBottom: '12px', position: 'relative' }}>
                        {(() => {
                          const canManageThread =
                            isSuperAdminUser || isCommunityAdmin || String(p.user_id) === String(userData?.user_id);
                          const canShowPostsMenu = isLoggedIn && (canPinToOverview || canManageThread);
                          if (!canShowPostsMenu) return null;
                          return (
                          <div style={{ position: 'absolute', right: 10, top: 10 }}>
                            <button
                              type="button"
                              className="kebab-button"
                              aria-haspopup="menu"
                              aria-expanded={openPostsMenuId === p.thread_id}
                              onClick={() =>
                                setOpenPostsMenuId((prev) => (prev === p.thread_id ? null : p.thread_id))
                              }
                            >
                              <FaEllipsisV />
                            </button>
                            {openPostsMenuId === p.thread_id && (
                              <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 26, zIndex: 10 }}>
                                {canPinToOverview && (
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => handlePinThreadToOverview(p)}
                                  >
                                    Pin to Pinned Topics
                                  </button>
                                )}
                                {canManageThread && (
                                  <>
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => handleEditThreadFromPosts(p)}
                                    >
                                      Edit Thread
                                    </button>
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => handleDeleteThreadFromPosts(p)}
                                    >
                                      Delete Thread
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })()}
                        <div className="meta-row" style={{ marginBottom: '4px' }}>
                          <span className="meta-quiet">{p.forum_name || 'Forum'}</span>
                          <span className="middot">·</span>
                          <span className="meta-quiet">{timeAgo(p.created_at)}</span>
                        </div>
                        <h4 style={{ margin: 0 }}>
                          <a
                            href={`/info/forum/${p.forum_id}/thread/${p.thread_id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            {p.title}
                          </a>
                        </h4>
                        <p className="muted" style={{ marginTop: 4 }}>
                          {p.first_name} {p.last_name ? `${p.last_name[0]}.` : ''}
                        </p>
                        {p.updated_by && p.updated_by_first_name && (
                          <p className="muted" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Last Edited on {formatShortDate(p.updated_at)} by</span>
                            <img
                              src={buildAvatarSrc(p.updated_by_avatar_path)}
                              alt={`${p.updated_by_first_name} ${p.updated_by_last_name || ''}`}
                              style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = buildAvatarSrc(null);
                              }}
                            />
                            <span>{p.updated_by_first_name} {p.updated_by_last_name || ''}</span>
                          </p>
                        )}
                        <div className="meta-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                          <span className="meta-quiet">{p.upvotes || 0} upvotes</span>
                          <span className="meta-quiet">{p.downvotes || 0} downvotes</span>
                          <span className="meta-quiet">{p.post_count || 0} posts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'qa' && (
              <div className="content-card community-qa-card">
                <div className="qa-header">
                  <div>
                    <h3>Questions &amp; answers</h3>
                    <p className="muted">Ask {group.name} ambassadors and browse verified community guidance.</p>
                  </div>
                  <button
                    type="button"
                    className="pill-button community-qa-ask"
                    onClick={() => {
                      if (!isLoggedIn) {
                        onRequireAuth?.();
                        return;
                      }
                      setShowQuestionModal(true);
                    }}
                  >
                    Ask a question
                  </button>
                </div>
                <div className="community-tab-search">
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={questionSearch}
                    onChange={(event) => setQuestionSearch(event.target.value)}
                    placeholder="Search questions and answers"
                    aria-label="Search questions and answers"
                  />
                  {questionSearch && (
                    <button type="button" onClick={() => setQuestionSearch('')} aria-label="Clear Q and A search">
                      ×
                    </button>
                  )}
                </div>

                <div className="qa-list">
                  {isLoadingQuestions ? (
                    <p>Loading questions...</p>
                  ) : questions.length === 0 ? (
                    <p>No questions yet.</p>
                  ) : visibleQuestions.length === 0 ? (
                    <p className="community-tab-empty">No questions match “{questionSearch}”.</p>
                  ) : (
                    visibleQuestions.map((q) => {
                      const isPending = q.status === 'pending';
                      const questionId = q.question_id || q.id;
                      return (
                        <article key={questionId} className="qa-item community-qa-item">
                          <div className="qa-item-header">
                            <div className="community-qa-item__heading">
                              <div className="community-qa-item__eyebrow">
                                <span>Question</span>
                                {isPending && <span className="community-qa-status">Pending review</span>}
                              </div>
                              <h4>{q.title}</h4>
                              <p className="community-qa-item__byline">
                                Asked by {q.asker_first_name} {q.asker_last_name}
                                {q.created_at ? ` · ${timeAgo(q.created_at)}` : ''}
                              </p>
                            </div>
                            {isAmbassador && isPending && (
                              <div className="qa-actions community-qa-moderation">
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => handleApproveQuestion(questionId)}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => {
                                    const reason = window.prompt('Provide a justification for declining:');
                                    if (!reason) return;
                                    handleRejectQuestion(questionId, reason);
                                  }}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="community-qa-item__question">{q.body}</p>

                          <div className="qa-answers">
                            {q.answers && q.answers.length > 0 ? (
                              q.answers.map((a) => (
                                <div key={a.answer_id || a.id} className="qa-answer community-qa-answer">
                                  <div className="community-qa-answer__meta">
                                    <span>Ambassador answer</span>
                                    <strong>{a.first_name} {a.last_name}</strong>
                                  </div>
                                  <p>{a.body}</p>
                                </div>
                              ))
                            ) : (
                              <p className="community-qa-unanswered">Awaiting an ambassador response.</p>
                            )}
                          </div>

                          {isAmbassador && (
                            <div className="qa-answer-form">
                              <textarea
                                placeholder="Write an answer..."
                                value={answerDrafts[questionId] || ''}
                                onChange={(e) =>
                                  setAnswerDrafts((prev) => ({ ...prev, [questionId]: e.target.value }))
                                }
                              />
                              <div className="qa-actions">
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => handleSubmitAnswer(questionId)}
                                >
                                  Post answer
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {['contact', 'events', 'polls'].includes(activeTab) && (
              <div className="content-card community-mobile-context community-embedded-tab-card" role="tabpanel">
                <RightRail
                  userData={userData}
                  communityContext={{ id: communityId, type: 'group' }}
                  section={activeTab}
                  embedded
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <ModalOverlay
        isOpen={showAmbassadorOverlay && isLoggedIn}
        contentClassName="ambassador-directory-overlay"
        onClose={() => {
      setShowAmbassadorOverlay(false);
      setMenuOpenFor(null);
    }}
  >
    <div className="ambassador-directory-dialog">
      <div className="qa-header">
        <div>
          <h3>Ambassadors</h3>
          <p className="muted">
            Group ambassadors are assigned directly by group admins after manual review of ownership and community alignment.
          </p>
        </div>
      </div>

          {loadingAmbassadors ? (
            <p>Loading ambassadors...</p>
          ) : errorAmbassadors ? (
            <p>{errorAmbassadors}</p>
          ) : ambassadors.length === 0 ? (
            <p>No current ambassadors.</p>
          ) : (
            <ul className="ambassador-list">
              {ambassadors.map((amb) => {
                const initials = getInitials(amb.first_name, amb.last_name);
                const avatarKey = amb.user_id || amb.id || initials;
                const isOnline = Number(amb.show_online ?? 1) === 1 && Boolean(amb.is_online);
                const avatarNode = amb.avatar_path ? (
                  <img
                    src={buildAvatarSrc(amb.avatar_path)}
                    alt={`${amb.first_name} ${amb.last_name}`}
                    className="ambassador-avatar"
                  />
                ) : (
                  <div
                    className="ambassador-avatar ambassador-avatar--initial"
                    aria-label={`${amb.first_name} ${amb.last_name}`}
                  >
                    {initials}
                  </div>
                );

                const isMenuOpen = menuOpenFor === amb.user_id;
                const isSelf = userData && String(userData.user_id) === String(amb.user_id);

                return (
                  <li key={avatarKey} className="ambassador-item">
                    <div className="presence-avatar">
                      {avatarNode}
                      {isOnline && <span className="presence-dot presence-dot--online" title="Online" />}
                    </div>
                    <div className="ambassador-info" style={{ textAlign: 'left' }}>
                      <p className="ambassador-name">
                        <a href={`/user/${amb.user_id}`}>
                          {amb.first_name} {amb.last_name}
                        </a>
                        {String(amb.community_role).toLowerCase() === 'admin' && <span className="muted"> · Admin</span>}
                      </p>
                      <p className="ambassador-headline">{amb.headline}</p>
                    </div>
                    {!isSelf && (
                      <div className="ambassador-actions">
                        <button className="pill-button secondary" onClick={() => setMenuOpenFor(isMenuOpen ? null : amb.user_id)}>
                          ⋯
                        </button>
                        {isMenuOpen && (
                          <div className="ambassador-menu">
                            <a href={`/messages?user=${amb.user_id}`} className="menu-item">
                              Message
                            </a>
                            <button
                              type="button"
                              className="menu-item"
                              disabled={!canEditCommunity || String(amb.community_role).toLowerCase() === 'admin'}
                              onClick={() => {
                                setMenuOpenFor(null);
                                handlePromoteToAdmin(amb);
                              }}
                            >
                              Promote to Admin
                            </button>
                            <button
                              type="button"
                              className="menu-item"
                              disabled={!canRemoveAmbassador || String(amb.community_role).toLowerCase() === 'admin'}
                              onClick={() => {
                                setMenuOpenFor(null);
                                handleRemoveAmbassador(amb);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ModalOverlay>

      <ModalOverlay
        isOpen={showEditModal}
        contentClassName="community-form-overlay community-form-overlay--edit"
        onClose={() => {
          setShowEditModal(false);
          setEditStatus('');
        }}
      >
        <div className="content-card community-form-dialog">
          <div className="qa-header">
            <div>
              <h3>Edit Community</h3>
              <p className="muted">Update basic info, branding, and media.</p>
            </div>
          </div>
          <form className="qa-form" onSubmit={handleUpdateCommunity}>
            <label className="qa-label" htmlFor="edit-name">Name</label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <label className="qa-label" htmlFor="edit-tagline">Tagline</label>
            <input
              id="edit-tagline"
              type="text"
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-location">Location</label>
            <input
              id="edit-location"
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-website">Website</label>
            <input
              id="edit-website"
              type="url"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-primary-color">Primary Color</label>
            <input
              id="edit-primary-color"
              type="color"
              value={editPrimaryColor || '#2F80ED'}
              onChange={(e) => setEditPrimaryColor(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-secondary-color">Secondary Color</label>
            <input
              id="edit-secondary-color"
              type="color"
              value={editSecondaryColor || '#1D5FC4'}
              onChange={(e) => setEditSecondaryColor(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-logo">Logo</label>
            <input
              id="edit-logo"
              type="file"
              accept="image/*"
              onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
            />
            <label className="qa-label" htmlFor="edit-banner">Banner</label>
            <input
              id="edit-banner"
              type="file"
              accept="image/*"
              onChange={(e) => setNewBannerFile(e.target.files?.[0] || null)}
            />
            <div className="qa-actions">
              <button
                type="submit"
                className="pill-button"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setEditStatus('');
                }}
              >
                Cancel
              </button>
            </div>
            {editStatus && <p className="muted" style={{ marginTop: 6 }}>{editStatus}</p>}
          </form>
        </div>
      </ModalOverlay>

      <ModalOverlay
        isOpen={showQuestionModal}
        contentClassName="community-form-overlay community-form-overlay--question"
        onClose={() => {
          setShowQuestionModal(false);
          setStatusMessage('');
        }}
      >
        <div className="content-card community-form-dialog">
          <div className="qa-header">
            <div>
              <h3>Ask a question</h3>
              <p className="muted">Your question will be sent to ambassadors for review.</p>
            </div>
          </div>
          <form className="qa-form" onSubmit={handleSubmitQuestion}>
            <label className="qa-label" htmlFor="qa-title">Question title</label>
            <input
              id="qa-title"
              type="text"
              value={questionTitle}
              onChange={(e) => setQuestionTitle(e.target.value)}
              placeholder="What would you like to know?"
              required
              disabled={!isLoggedIn || isSubmittingQuestion}
            />
            <label className="qa-label" htmlFor="qa-body">Details</label>
            <textarea
              id="qa-body"
              value={questionBody}
              onChange={(e) => setQuestionBody(e.target.value)}
              placeholder="Add context so ambassadors can help quickly."
              required
              disabled={!isLoggedIn || isSubmittingQuestion}
            />
            <div className="qa-actions">
              <button
                type="submit"
                className="pill-button"
                disabled={!isLoggedIn || isSubmittingQuestion}
                onClick={() => {
                  if (!isLoggedIn) {
                    onRequireAuth?.();
                  }
                }}
              >
                {isSubmittingQuestion ? 'Submitting…' : 'Submit question'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                onClick={() => setShowQuestionModal(false)}
              >
                Cancel
              </button>
            </div>
            {statusMessage && <p className="muted" style={{ marginTop: 6 }}>{statusMessage}</p>}
            {!isLoggedIn && (
              <p className="muted" style={{ marginTop: 8 }}>
                Log in to submit a question.
              </p>
            )}
          </form>
        </div>
      </ModalOverlay>

      <ReportModal
        isOpen={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
        submitting={isSubmittingReport}
      />
    </div>
  );
}

export default GroupProfile;
