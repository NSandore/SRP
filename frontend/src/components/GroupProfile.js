// src/components/GroupProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FaLock } from 'react-icons/fa';
import './GroupProfile.css';
import ModalOverlay from './ModalOverlay';

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
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);
  const [ambassadorsLoaded, setAmbassadorsLoaded] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  const currentAmbassador = ambassadors.find((a) => String(a.user_id) === String(userData?.user_id));
  const viewerRole = (currentAmbassador?.role || '').toLowerCase() || 'viewer';
  const isSuperAdmin = Number(userData?.role_id) === 1;
  const isCommunityAdmin = viewerRole === 'admin';
  const canEditCommunity = Boolean(userData) && (isSuperAdmin || isCommunityAdmin);
  const canRemoveAmbassador = Boolean(userData) && (isSuperAdmin || isCommunityAdmin);

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
          setEditPrimaryColor(response.data.group.primary_color || '#0077B5');
          setEditSecondaryColor(response.data.group.secondary_color || '#005f8d');
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
    setAmbassadorsLoaded(false);
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
      setAmbassadorsLoaded(true);
    }
  };

  useEffect(() => {
    fetchAmbassadors();
  }, [id]);

  const isLoggedIn = Boolean(userData);
  const isAmbassador =
    isLoggedIn &&
    ambassadors.some((a) => String(a.user_id || a.id) === String(userData.user_id));
  const canApplyForAmbassador = isLoggedIn && ambassadorsLoaded && !isAmbassador;

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

  useEffect(() => {
    const fetchPostsForGroup = async () => {
      setPostsLoading(true);
      setPostsError(null);
      try {
        // 1) Fetch forums for this community
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

        // 2) Fetch threads for each forum
        const threadsPromises = forumsList.map(async (forum) => {
          const tRes = await axios.get(
            `/api/fetch_threads.php?forum_id=${forum.forum_id}&user_id=${userData?.user_id || ''}`
          );
          const threads = Array.isArray(tRes.data) ? tRes.data : [];
          return threads.map((t) => ({ ...t, forum_name: forum.name }));
        });

        const threadGroups = await Promise.all(threadsPromises);
        const allThreads = threadGroups.flat();
        // Sort newest first
        allThreads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setPosts(allThreads);
      } catch (err) {
        console.error('Error fetching group posts:', err);
        setPostsError('Unable to load posts.');
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    if (activeTab === 'posts') {
      fetchPostsForGroup();
    }
  }, [activeTab, id, userData?.user_id]);

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!group) return <p>No group found.</p>;
  const hasAmbassadors = ambassadors.length > 0;

  const openEdit = () => {
    if (!canEditCommunity) return;
    setEditStatus('');
    setNewLogoFile(null);
    setNewBannerFile(null);
    setEditName(group.name || '');
    setEditTagline(group.tagline || '');
    setEditLocation(group.location || '');
    setEditWebsite(group.website || '');
    setEditPrimaryColor(group.primary_color || '#0077B5');
    setEditSecondaryColor(group.secondary_color || '#005f8d');
    setShowEditModal(true);
  };

  const handleRemoveAmbassador = async (amb) => {
    if (!canRemoveAmbassador || String(amb.role).toLowerCase() === 'admin') return;
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
    if (!canEditCommunity || String(amb.role).toLowerCase() === 'admin') return;
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
      if (res.data.success) {
        const updated = res.data.university || res.data.group || res.data.community || null;
        if (updated) {
          setGroup(updated);
          setEditStatus('Community updated successfully.');
          setShowEditModal(false);
        } else {
          setEditStatus('Updated, but no data returned. Please refresh.');
        }
      } else {
        setEditStatus(res.data.error || 'Unable to update community.');
      }
    } catch (err) {
      setEditStatus('An error occurred while updating.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const logoSrc =
    group.logo_path && group.logo_path.startsWith('/')
      ? group.logo_path
      : `/uploads/logos/${group.logo_path || 'default-logo.png'}`;

  return (
    <div className="profile-container" style={{
      '--primary-color': group.primary_color || '#0077B5',
      '--secondary-color': group.secondary_color || '#005f8d',
    }}>
      <section className="profile-main">
        {/* HERO CARD */}
        <div className="hero-card community-hero">
          <div className="hero-banner">
            <img src={group.banner_path || '/uploads/banners/DefaultBanner.jpeg'} alt="Group Banner" />
          </div>
          <div className="hero-content">
            <div className="hero-left">
              <div className="community-hero-logo-wrap">
                <img src={logoSrc || '/uploads/logos/default-logo.png'} alt="Group Logo" className="community-hero-logo" />
              </div>
              <div className="hero-text">
                <h1 className="hero-title">{group.name}</h1>
                <p className="muted" style={{ marginTop: 6 }}>
                  {followersCount} follower{followersCount === 1 ? '' : 's'}
                </p>
                {group.tagline && <p className="hero-sub">{group.tagline}</p>}
                {group.location && <p className="hero-sub">{group.location}</p>}
              </div>
            </div>
            <div className="hero-right">
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
                  Edit Community
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
            <button
              type="button"
              className={`tab-link ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Posts
            </button>
            <button
              type="button"
              className={`tab-link ${activeTab === 'qa' ? 'active' : ''}`}
              onClick={() => setActiveTab('qa')}
            >
              Q+A
            </button>
          </div>
        </div>

        {/* Below hero: two-column split — main content + right cards */}
        <div className={`profile-split ${activeTab === 'qa' ? 'fullwidth' : ''}`}>
          <div className="split-main">
            {activeTab === 'overview' && null}

            {activeTab === 'posts' && (
              <div className="content-card">
                <div className="posts-list">
                  {postsLoading ? (
                    <p>Loading posts...</p>
                  ) : postsError ? (
                    <p>{postsError}</p>
                  ) : posts.length === 0 ? (
                    <p>No posts yet.</p>
                  ) : (
                    posts.map((p) => (
                      <div key={p.thread_id} className="forum-card card-lift" style={{ marginBottom: '12px' }}>
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
              <div className="content-card">
                <div className="qa-header">
                  <div>
                    <h3>Group Q+A</h3>
                    <p className="muted">Submit a question for ambassadors. Approved items appear for everyone.</p>
                  </div>
                  <button
                    type="button"
                    className="pill-button"
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

                <div className="qa-list">
                  {isLoadingQuestions ? (
                    <p>Loading questions...</p>
                  ) : questions.length === 0 ? (
                    <p>No questions yet.</p>
                  ) : (
                    questions.map((q) => {
                      const isPending = q.status === 'pending';
                      return (
                        <div key={q.id} className="qa-item">
                          <div className="qa-item-header">
                            <div>
                              <h4>{q.title}</h4>
                              <p className="muted">
                                Asked by {q.asker_first_name} {q.asker_last_name}
                                {isPending && ' · Pending approval'}
                              </p>
                            </div>
                      {isAmbassador && isPending && (
                        <div className="qa-actions">
                          <button
                            type="button"
                            className="pill-button secondary"
                            onClick={() => handleApproveQuestion(q.id)}
                          >
                            Add to Q+A list
                          </button>
                          <button
                            type="button"
                            className="pill-button secondary"
                            onClick={() => {
                              const reason = window.prompt('Provide a justification for declining:');
                              if (!reason) return;
                              handleRejectQuestion(q.id, reason);
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                          </div>
                          <p style={{ marginTop: 6 }}>{q.body}</p>

                          <div className="qa-answers">
                            {q.answers && q.answers.length > 0 ? (
                              q.answers.map((a) => (
                                <div key={a.id} className="qa-answer">
                                  <strong>{a.first_name} {a.last_name}</strong>
                                  <p>{a.body}</p>
                                </div>
                              ))
                            ) : (
                              <p className="muted">No answers yet.</p>
                            )}
                          </div>

                          {isAmbassador && (
                            <div className="qa-answer-form">
                              <textarea
                                placeholder="Write an answer..."
                                value={answerDrafts[q.id] || ''}
                                onChange={(e) =>
                                  setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                                }
                              />
                              <div className="qa-actions">
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => handleSubmitAnswer(q.id)}
                                >
                                  Post answer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {activeTab !== 'qa' && (
          <aside className="split-aside">
            <div className="info-card">
              <h3>Ambassadors</h3>
              {hasAmbassadors ? (
                <div className="avatar-stack" style={{ marginBottom: 8 }}>
                  {ambassadors.slice(0, 6).map((a) => {
                    const initials = getInitials(a.first_name, a.last_name);
                    const key = a.user_id || a.id || initials;
                    return a.avatar_path ? (
                      <img
                        key={key}
                        className="avatar"
                        src={a.avatar_path}
                        alt={`${a.first_name} ${a.last_name}`}
                      />
                    ) : (
                      <div key={key} className="avatar avatar-initial" aria-label={`${a.first_name} ${a.last_name}`}>
                        {initials}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted" style={{ marginBottom: 8 }}>
                  No current ambassadors.
                </p>
              )}
              <button
                className={`pill-button ${!isLoggedIn ? 'locked' : ''}`}
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    onRequireAuth?.();
                    return;
                  }
                  setShowAmbassadorOverlay(true);
                  fetchAmbassadors(true);
                }}
                aria-disabled={!isLoggedIn}
                title={!isLoggedIn ? 'Log in to view ambassadors' : 'View ambassadors'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!isLoggedIn && <FaLock size={12} />}
                  View all
                </span>
              </button>
            </div>
            <div className="info-card">
              <h3>Contact Us</h3>
              {group.website ? (
                <p style={{ margin: 0 }}>
                  <a href={group.website} target="_blank" rel="noopener noreferrer">{group.website}</a>
                </p>
              ) : null}
              {group.contact_email || group.email ? (
                <p className="muted" style={{ margin: '6px 0 0 0' }}>{group.contact_email || group.email}</p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No contact info provided.</p>
              )}
            </div>
          </aside>
          )}
        </div>
      </section>

      <ModalOverlay
        isOpen={showAmbassadorOverlay && isLoggedIn}
        onClose={() => {
      setShowAmbassadorOverlay(false);
      setMenuOpenFor(null);
    }}
  >
    <div className="content-card">
      <div className="qa-header">
        <div>
          <h3>Ambassadors</h3>
          <p className="muted">
            Ambassador status is earned by applying and verifying school affiliation. Existing admins can still manage roles.
          </p>
        </div>
        {canApplyForAmbassador && (
          <button
            type="button"
            className="pill-button"
            onClick={() => {
              alert('Ambassador applications will guide you through school verification. This flow is coming soon.');
            }}
          >
            Apply to be an Ambassador
          </button>
        )}
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
                    src={amb.avatar_path}
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
                        {String(amb.role).toLowerCase() === 'admin' && <span className="muted"> · Admin</span>}
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
                              disabled={!canEditCommunity || String(amb.role).toLowerCase() === 'admin'}
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
                              disabled={!canRemoveAmbassador || String(amb.role).toLowerCase() === 'admin'}
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
        onClose={() => {
          setShowEditModal(false);
          setEditStatus('');
        }}
      >
        <div className="content-card">
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
              value={editPrimaryColor || '#0077B5'}
              onChange={(e) => setEditPrimaryColor(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-secondary-color">Secondary Color</label>
            <input
              id="edit-secondary-color"
              type="color"
              value={editSecondaryColor || '#005f8d'}
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
        onClose={() => {
          setShowQuestionModal(false);
          setStatusMessage('');
        }}
      >
        <div className="content-card">
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
    </div>
  );
}

export default GroupProfile;
