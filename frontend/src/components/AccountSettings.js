import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FaBell,
  FaBullhorn,
  FaLock,
  FaShieldAlt,
  FaUserCog,
  FaUsers,
  FaUniversity
} from 'react-icons/fa';

const createDefaultSettings = () => ({
  profile: {
    profileVisibility: 'network',
    showOnline: true,
    allowMessagesFrom: 'connections',
    showEmail: 'hidden', // hidden | connections | everyone
    discoverable: 'everyone', // no_one | connections | everyone
  },
  notifications: {
    inApp: true,
    email: true,
    mentions: true,
    replies: true,
    votes: true,
    messages: true,
    communityAnnouncements: true,
    weeklyDigest: true,
  },
  security: {
    twoFactor: false,
    loginAlerts: true,
    sessionTimeout: '30',
    trustedDevicesOnly: false,
  },
  feed: {
    defaultFeed: 'yourFeed',
    autoplayMedia: false,
    openLinksInNewTab: true,
    filterFollowedCommunities: true,
    includeEvents: true,
  },
  community: {
    autoJoinCampus: true,
    allowInvites: true,
    showAchievements: true,
    hideNSFW: true,
  },
  moderation: {
    escalateReports: true,
    lockThreads: false,
    approveNewMembers: true,
  },
  admin: {
    maintenanceMode: false,
    requireSSO: false,
    enableAnalytics: true,
  },
  ambassador: {
    spotlightInFeed: true,
    dmOfficeHours: true,
    autoReplyTemplates: false,
  },
});

const roleLabel = (roleId) => {
  if (roleId >= 7) return 'Admin';
  if (roleId >= 5) return 'Moderator';
  if (roleId >= 3) return 'Staff';
  return 'Member';
};

function AccountSettings({ userData }) {
  const roleId = Number(userData?.role_id || 0);
  const isModerator = roleId >= 5;
  const isAdmin = roleId >= 7;
  const [fetchedIsAmbassador, setFetchedIsAmbassador] = useState(Number(userData?.is_ambassador) === 1 ? 1 : 0);
  const isAmbassador = Number(fetchedIsAmbassador) === 1;
  const navigate = useNavigate();

  const [settings, setSettings] = useState(createDefaultSettings);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [status, setStatus] = useState('');
  const statusTimerRef = useRef(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const tabs = useMemo(() => {
    const base = [
      { id: 'profile', label: 'Profile', icon: <FaUserCog size={16} /> },
      { id: 'notifications', label: 'Notifications', icon: <FaBell size={16} /> },
      { id: 'security', label: 'Security', icon: <FaShieldAlt size={16} /> },
      { id: 'feed', label: 'Feed', icon: <FaUsers size={16} /> },
      { id: 'community', label: 'Community', icon: <FaUniversity size={16} /> },
      isModerator ? { id: 'moderation', label: 'Moderation', icon: <FaBullhorn size={16} /> } : null,
      isAmbassador ? { id: 'ambassador', label: 'Ambassador', icon: <FaUsers size={16} /> } : null,
      isAdmin ? { id: 'admin', label: 'Admin', icon: <FaLock size={16} /> } : null,
      { id: 'sessions', label: 'Sessions', icon: <FaShieldAlt size={16} /> },
      { id: 'data', label: 'Data', icon: <FaLock size={16} /> },
    ];
    return base.filter(Boolean);
  }, [isModerator, isAmbassador, isAdmin]);
  const [activeTab, setActiveTab] = useState('profile');

  const flashStatus = (message) => {
    setStatus(message);
    window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 1800);
  };

  useEffect(() => {
    const fetchVisibility = async () => {
      if (!userData?.user_id) return;
      try {
        const res = await axios.get(`/api/fetch_user.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        });
          if (res.data?.success && res.data.user) {
            if (res.data.user.profile_visibility) {
              const vis = res.data.user.profile_visibility;
              setSettings((prev) => ({
                ...prev,
              profile: {
                ...prev.profile,
                profileVisibility: vis,
              },
            }));
          }
          if (typeof res.data.user.is_ambassador !== 'undefined') {
            setFetchedIsAmbassador(res.data.user.is_ambassador);
          }
          if (typeof res.data.user.show_online !== 'undefined') {
            setSettings((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                showOnline: Boolean(Number(res.data.user.show_online)),
              },
            }));
          }
          if (res.data.user.allow_messages_from) {
            setSettings((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                allowMessagesFrom: res.data.user.allow_messages_from,
              },
            }));
          }
          if (typeof res.data.user.show_email !== 'undefined') {
            const raw = Number(res.data.user.show_email);
            const mapped = raw === 2 ? 'everyone' : raw === 1 ? 'connections' : 'hidden';
            setSettings((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                showEmail: mapped,
              },
            }));
          }
          if (typeof res.data.user.discoverable !== 'undefined') {
            const discRaw = Number(res.data.user.discoverable);
            const mappedDisc = discRaw === 2 ? 'everyone' : discRaw === 1 ? 'connections' : 'no_one';
            setSettings((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                discoverable: mappedDisc,
              },
            }));
          }
          if (typeof res.data.user.notify_votes !== 'undefined') {
            setSettings((prev) => ({
              ...prev,
              notifications: {
                ...prev.notifications,
                votes: Boolean(Number(res.data.user.notify_votes)),
              },
            }));
          }
          if (typeof res.data.user.session_timeout_minutes !== 'undefined') {
            setSettings((prev) => ({
              ...prev,
              security: {
                ...prev.security,
                sessionTimeout: String(res.data.user.session_timeout_minutes),
              },
            }));
          }
          const serverDefaultFeed = res.data.user.default_feed;
          if (serverDefaultFeed) {
            setSettings((prev) => ({
              ...prev,
              feed: {
                ...prev.feed,
                defaultFeed: serverDefaultFeed,
              },
            }));
            try {
              localStorage.setItem('defaultFeed', serverDefaultFeed);
            } catch (err) {
              // ignore storage issues
            }
          }
        }
      } catch (err) {
        console.error('Error loading profile visibility', err);
      }
    };
    fetchVisibility();
  }, [userData]);

  useEffect(() => {
    // If no server value yet but a stored value exists, hydrate the dropdown
    const storedDefaultFeed = typeof window !== 'undefined' ? localStorage.getItem('defaultFeed') : null;
    if (storedDefaultFeed) {
      setSettings((prev) => ({
        ...prev,
        feed: {
          ...prev.feed,
          defaultFeed: storedDefaultFeed,
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (!isAmbassador && settings.profile.profileVisibility === 'network') {
      setSettings((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          profileVisibility: 'followers',
        },
      }));
    }
  }, [isAmbassador, settings.profile.profileVisibility]);

  const persistProfileVisibility = async (visibility) => {
    if (!userData?.user_id) return;
    if (!isAmbassador && visibility === 'network') {
      return;
    }
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          profile_visibility: visibility,
        },
        { withCredentials: true }
      );
    } catch (err) {
      // Non-blocking; keep UI responsive
      console.error('Error saving profile visibility', err);
    }
  };

  const persistShowOnline = async (visible) => {
    if (!userData?.user_id) return;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          show_online: visible,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving online visibility', err);
    }
  };

  const persistAllowMessages = async (value) => {
    if (!userData?.user_id) return;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          allow_messages_from: value,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving DM preference', err);
    }
  };

  const persistShowEmail = async (value) => {
    if (!userData?.user_id) return;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          show_email: value,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving email visibility', err);
    }
  };

  const persistDiscoverable = async (value) => {
    if (!userData?.user_id) return;
    const map = {
      no_one: 0,
      connections: 1,
      everyone: 2,
    };
    const payloadVal = map[value] ?? 0;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          discoverable: payloadVal,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving discoverability', err);
    }
  };

  const persistVotesPref = async (value) => {
    if (!userData?.user_id) return;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          notify_votes: value,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving vote notifications preference', err);
    }
  };

  const persistSessionTimeout = async (value) => {
    if (!userData?.user_id) return;
    try {
      await axios.post(
        '/api/update_account_settings.php',
        {
          user_id: userData.user_id,
          session_timeout_minutes: value,
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error saving session timeout', err);
    }
  };

  const updateSetting = (section, key, value) => {
    if (section === 'profile' && key === 'profileVisibility' && value === 'network' && !isAmbassador) {
      flashStatus('This option is only available for group ambassadors');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    if (section === 'profile' && key === 'profileVisibility') {
      persistProfileVisibility(value);
    }
    if (section === 'profile' && key === 'showOnline') {
      persistShowOnline(value);
    }
    if (section === 'profile' && key === 'allowMessagesFrom') {
      persistAllowMessages(value);
    }
    if (section === 'profile' && key === 'showEmail') {
      persistShowEmail(value);
    }
    if (section === 'profile' && key === 'discoverable') {
      persistDiscoverable(value);
    }
    if (section === 'security' && key === 'sessionTimeout') {
      persistSessionTimeout(value);
    }
    if (section === 'notifications' && key === 'votes') {
      persistVotesPref(value);
    }
    if (section === 'feed' && key === 'defaultFeed') {
      try {
        localStorage.setItem('defaultFeed', value);
      } catch (err) {
        // ignore storage errors
      }
      if (userData?.user_id) {
        axios.post(
          '/api/update_account_settings.php',
          {
            user_id: userData.user_id,
            default_feed: value,
          },
          { withCredentials: true }
        ).catch((err) => console.error('Error saving default feed', err));
      }
    }
    flashStatus('Saved');
  };

  const resetSettings = () => {
    setSettings(createDefaultSettings());
    flashStatus('Reset to defaults');
  };

  // Theme handling
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const dark = savedTheme === 'dark';
    setIsDarkMode(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
    flashStatus('Theme updated');
  };

  const confirmReset = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    resetSettings();
    setShowResetModal(false);
  };

  const handleCancelReset = () => setShowResetModal(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [liveBadge] = useState('Live');
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const loadSessions = useCallback(async () => {
    if (!userData?.user_id) return;
    setLoadingSessions(true);
    setSessionsError('');
    try {
      const res = await axios.get('/api/fetch_sessions.php', { withCredentials: true });
      if (res.data?.success) {
        setSessions(res.data.sessions || []);
      } else {
        setSessionsError(res.data?.error || 'Unable to load sessions.');
      }
    } catch (err) {
      console.error('Error loading sessions', err);
      setSessionsError('Unable to load sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, [userData]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
    }
  }, [activeTab, loadSessions]);

  const revokeSession = async (sessionId) => {
    const target = sessions.find((s) => s.session_id === sessionId);
    const isCurrent = target?.current;
    try {
      await axios.post(
        '/api/revoke_session.php',
        { session_id: sessionId },
        { withCredentials: true }
      );
      if (isCurrent) {
        window.location.href = '/login';
      } else {
        setSessions((prev) =>
          prev.map((s) => (s.session_id === sessionId ? { ...s, revoked_at: new Date().toISOString() } : s))
        );
      }
    } catch (err) {
      console.error('Error revoking session', err);
      flashStatus('Unable to sign out that session.');
    }
  };

  const parseUserAgent = (ua) => {
    if (!ua) return { os: 'Unknown OS', browser: 'Unknown browser' };
    let os = 'Unknown OS';
    if (/Mac OS X ([0-9_\.]+)/i.test(ua)) {
      os = `Mac OS X ${RegExp.$1.replace(/_/g, '.')}`;
    } else if (/Windows NT ([0-9\.]+)/i.test(ua)) {
      os = `Windows ${RegExp.$1}`;
    } else if (/Android ([0-9\.]+)/i.test(ua)) {
      os = `Android ${RegExp.$1}`;
    } else if (/iPhone OS ([0-9_]+)/i.test(ua)) {
      os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
    }

    let browser = 'Browser';
    if (/Firefox\/([\d\.]+)/i.test(ua)) {
      browser = `Firefox/${RegExp.$1}`;
    } else if (/Edg\/([\d\.]+)/i.test(ua)) {
      browser = `Edge/${RegExp.$1}`;
    } else if (/Chrome\/([\d\.]+)/i.test(ua) && !/Edg\//i.test(ua)) {
      browser = `Chrome/${RegExp.$1}`;
    } else if (/Version\/([\d\.]+).*Safari/i.test(ua)) {
      browser = `Safari/${RegExp.$1}`;
    }

    return { os, browser };
  };

  const formatSessionMeta = (s) => {
    const last = s.last_active_at ? new Date(s.last_active_at) : null;
    const lastLabel = last ? last.toLocaleString() : 'Unknown';
    const { os, browser } = parseUserAgent(s.user_agent);
    const headline = `${os} · ${browser}`;
    const location = s.location || s.ip_address || 'Location unavailable';
    return { headline, location, lastLabel };
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <p className="settings-kicker">Account</p>
          <h1 className="settings-title">Account settings</h1>
          <div className="settings-meta">
            {userData?.email && <span className="settings-badge">{userData.email}</span>}
            <span className="settings-badge">Access: {roleLabel(roleId)}</span>
            {isAmbassador && <span className="settings-badge positive">Ambassador</span>}
          </div>
          <button
            type="button"
            className="pill-button secondary settings-back"
            onClick={() => navigate('/home')}
          >
            ← Back to home
          </button>
        </div>
        <div className="settings-actions">
          <button type="button" className="pill-button" onClick={() => flashStatus('Saved')}>
            Save changes
          </button>
          <button type="button" className="pill-button secondary" onClick={confirmReset}>
            Reset defaults
          </button>
        </div>
      </div>

      {status && <div className="settings-status">{status}</div>}

      <div className="settings-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="settings-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-grid">
        {activeTab === 'profile' && (
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaUserCog size={16} /> Profile & identity
            </div>
            <p>How you appear across forums and threads.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Profile visibility <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Limit profile details to your campus network or followers.</p>
            </div>
            <select
              value={settings.profile.profileVisibility}
              onChange={(e) => updateSetting('profile', 'profileVisibility', e.target.value)}
            >
              <option
                value="network"
                disabled={!isAmbassador}
                title={!isAmbassador ? 'This option is only available for group ambassadors' : undefined}
              >
                Group Members Only
              </option>
              <option value="followers">Followers only</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Direct messages <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Choose who can start conversations with you.</p>
            </div>
            <select
              value={settings.profile.allowMessagesFrom}
              onChange={(e) => updateSetting('profile', 'allowMessagesFrom', e.target.value)}
            >
              <option value="connections">Connections only</option>
              <option value="community">Community only</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Contact visibility <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Choose who can see your email on your profile.</p>
            </div>
            <select
              value={settings.profile.showEmail}
              onChange={(e) => updateSetting('profile', 'showEmail', e.target.value)}
            >
              <option value="hidden">Hidden</option>
              <option value="connections">Connections only</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Discoverability <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Allow others to find you in search and recommendations.</p>
            </div>
            <select
              value={settings.profile.discoverable}
              onChange={(e) => updateSetting('profile', 'discoverable', e.target.value)}
            >
              <option value="no_one">No one</option>
              <option value="connections">Connections only</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Dark mode <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Switch the app theme between light and dark.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={toggleDarkMode}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>
        )}

        {activeTab === 'notifications' && (
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaBell size={16} /> Notifications
            </div>
            <p>Stay on top of replies, messages, and campus news.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Email updates</div>
              <p className="setting-help">Security alerts and activity summaries.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Replies <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Notify me when my posts get replies.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.replies}
                onChange={(e) => updateSetting('notifications', 'replies', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Votes <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Notify me when my posts get upvotes or downvotes.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.votes}
                onChange={(e) => updateSetting('notifications', 'votes', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>
        )}

        {activeTab === 'security' && (
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaShieldAlt size={16} /> Security
            </div>
            <p>Protect your account and control sign-ins.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Two-factor auth</div>
              <p className="setting-help">Add a code when signing in from new devices.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.security.twoFactor}
                onChange={(e) => updateSetting('security', 'twoFactor', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Login alerts</div>
              <p className="setting-help">Email me when a new device signs in.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.security.loginAlerts}
                onChange={(e) => updateSetting('security', 'loginAlerts', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Session timeout <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Log me out after inactivity.</p>
            </div>
            <select
              value={settings.security.sessionTimeout}
              onChange={(e) => updateSetting('security', 'sessionTimeout', e.target.value)}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
            </select>
          </div>
        </section>
        )}

        {activeTab === 'feed' && (
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaUsers size={16} /> Feed and content
            </div>
            <p>Defaults for your feed, saved items, and media.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Default feed <span className="settings-badge live-badge">{liveBadge}</span></div>
              <p className="setting-help">Where to drop you after sign-in.</p>
            </div>
            <select
              value={settings.feed.defaultFeed}
              onChange={(e) => updateSetting('feed', 'defaultFeed', e.target.value)}
            >
              <option value="yourFeed">Your feed</option>
              <option value="explore">Explore</option>
              <option value="info">Info board</option>
            </select>
          </div>
        </section>
        )}

        {activeTab === 'community' && (
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaUniversity size={16} /> Community access
            </div>
            <p>Invites, memberships, and safety defaults.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Auto-join campus groups</div>
              <p className="setting-help">Automatically accept invites from your university teams.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.community.autoJoinCampus}
                onChange={(e) => updateSetting('community', 'autoJoinCampus', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Allow invites</div>
              <p className="setting-help">Let members invite you to closed forums.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.community.allowInvites}
                onChange={(e) => updateSetting('community', 'allowInvites', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>
        )}

        {isModerator && activeTab === 'moderation' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <div className="settings-card-eyebrow">
                <FaBullhorn size={16} /> Moderation tools
              </div>
              <p>Surface the controls you need while moderating forums.</p>
            </div>
            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Escalate new reports</div>
                <p className="setting-help">Send report digests to your inbox for forums you manage.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.moderation.escalateReports}
                  onChange={(e) => updateSetting('moderation', 'escalateReports', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Lock quiet threads</div>
                <p className="setting-help">Auto-lock threads after 7 days of inactivity.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.moderation.lockThreads}
                  onChange={(e) => updateSetting('moderation', 'lockThreads', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Approve new members</div>
                <p className="setting-help">Require approval for new joins to private forums.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.moderation.approveNewMembers}
                  onChange={(e) => updateSetting('moderation', 'approveNewMembers', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          </section>
        )}

        {isAmbassador && activeTab === 'ambassador' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <div className="settings-card-eyebrow">
                <FaUsers size={16} /> Ambassador tools
              </div>
              <p>Control how you appear to prospective students and partners.</p>
            </div>
            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Spotlight in feed</div>
                <p className="setting-help">Feature ambassador posts in campus-wide feeds.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.ambassador.spotlightInFeed}
                  onChange={(e) => updateSetting('ambassador', 'spotlightInFeed', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">DM office hours</div>
                <p className="setting-help">Allow students to book office-hour style chats.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.ambassador.dmOfficeHours}
                  onChange={(e) => updateSetting('ambassador', 'dmOfficeHours', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Enable reply templates</div>
                <p className="setting-help">Use saved replies for common admissions questions.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.ambassador.autoReplyTemplates}
                  onChange={(e) => updateSetting('ambassador', 'autoReplyTemplates', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          </section>
        )}

        {isAdmin && activeTab === 'admin' && (
          <section className="settings-card">
            <div className="settings-card-heading">
              <div className="settings-card-eyebrow">
                <FaLock size={16} /> Admin & compliance
              </div>
              <p>High-trust controls for platform safety.</p>
            </div>
            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Maintenance mode</div>
                <p className="setting-help">Show a banner before scheduled downtime.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.admin.maintenanceMode}
                  onChange={(e) => updateSetting('admin', 'maintenanceMode', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Require SSO</div>
                <p className="setting-help">Limit sign-in to verified university single sign-on.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.admin.requireSSO}
                  onChange={(e) => updateSetting('admin', 'requireSSO', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-label">Analytics</div>
                <p className="setting-help">Enable anonymized engagement metrics.</p>
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings.admin.enableAnalytics}
                  onChange={(e) => updateSetting('admin', 'enableAnalytics', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          </section>
        )}

        {activeTab === 'sessions' && (
        <section className="settings-card full-span">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaShieldAlt size={16} /> Sessions and devices
            </div>
            <p>Sign out devices you do not recognize.</p>
          </div>
          <div className="session-list">
            {loadingSessions && <p>Loading sessions…</p>}
            {sessionsError && <p className="error-text">{sessionsError}</p>}
            {!loadingSessions && !sessionsError && sessions.length === 0 && (
              <p className="muted">No active sessions found.</p>
            )}
            {!loadingSessions && !sessionsError && sessions.map((session) => (
              (() => {
                const meta = formatSessionMeta(session);
                return (
              <div
                key={session.session_id}
                className={`session-item${session.current ? ' current' : ''}${session.revoked_at ? ' revoked' : ''}`}
              >
                <div className="session-meta">
                  <div className="setting-label">{meta.headline}</div>
                  <div className="setting-help">{meta.location}</div>
                  <div className="setting-help">Last active {meta.lastLabel}</div>
                </div>
                <div className="session-actions">
                  {session.current && <span className="settings-badge positive">This device</span>}
                  {session.revoked_at && <span className="settings-badge danger">Signed out</span>}
                  {!session.current && !session.revoked_at && (
                    <button type="button" className="pill-button secondary small" onClick={() => revokeSession(session.session_id)}>
                      Sign out
                    </button>
                  )}
                </div>
              </div>
                );
              })()
            ))}
          </div>
        </section>
        )}

        {activeTab === 'data' && (
        <section className="settings-card full-span">
          <div className="settings-card-heading">
            <div className="settings-card-eyebrow">
              <FaLock size={16} /> Data and controls
            </div>
            <p>Export or pause your account.</p>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Download data</div>
              <p className="setting-help">Export posts, messages, and connections as a zip.</p>
            </div>
            <button type="button" className="pill-button secondary small">
              Generate export
            </button>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Deactivate account</div>
              <p className="setting-help">Temporarily hide your profile and content.</p>
            </div>
            <button type="button" className="pill-button danger small">
              Deactivate
            </button>
          </div>
        </section>
        )}
      </div>

      {showResetModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <div className="modal-content">
            <h3 id="reset-modal-title">Reset settings?</h3>
            <p>Are you sure you want to reset your settings to the defaults?</p>
            <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="pill-button secondary" onClick={handleCancelReset}>
                Cancel
              </button>
              <button type="button" className="pill-button danger" onClick={handleConfirmReset}>
                Reset defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="settings-footnote">Profile visibility and online status save to your account; remaining toggles are local-only for now.</p>
    </div>
  );
}

export default AccountSettings;
