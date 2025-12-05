import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    allowMessagesFrom: 'followers',
    showEmail: false,
    discoverable: true,
  },
  notifications: {
    inApp: true,
    email: true,
    mentions: true,
    replies: true,
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
        }
      } catch (err) {
        console.error('Error loading profile visibility', err);
      }
    };
    fetchVisibility();
  }, [userData]);

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
    flashStatus('Saved');
  };

  const resetSettings = () => {
    setSettings(createDefaultSettings());
    flashStatus('Reset to defaults');
  };

  const confirmReset = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    resetSettings();
    setShowResetModal(false);
  };

  const handleCancelReset = () => setShowResetModal(false);

  const activeSessions = useMemo(
    () => [
      { id: 'current', device: 'MacBook Pro · Chrome', location: 'Chicago, IL', lastActive: 'Active now', trusted: true, current: true },
      { id: 'mobile', device: 'iPhone · Safari', location: 'Chicago, IL', lastActive: '3h ago', trusted: true, current: false },
      { id: 'lab', device: 'Windows · Edge', location: 'Campus lab', lastActive: '2d ago', trusted: false, current: false },
    ],
    []
  );
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

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
              <div className="setting-label">Profile visibility</div>
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
              <div className="setting-label">Show online status</div>
              <p className="setting-help">Toggle your active status in messages and connection suggestions.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.profile.showOnline}
                onChange={(e) => updateSetting('profile', 'showOnline', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Direct messages</div>
              <p className="setting-help">Choose who can start conversations with you.</p>
            </div>
            <select
              value={settings.profile.allowMessagesFrom}
              onChange={(e) => updateSetting('profile', 'allowMessagesFrom', e.target.value)}
            >
              <option value="followers">Followers only</option>
              <option value="campus">Campus network</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Show email on profile</div>
              <p className="setting-help">Keep contact info private except for verified university staff.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.profile.showEmail}
                onChange={(e) => updateSetting('profile', 'showEmail', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Discoverability</div>
              <p className="setting-help">Allow others to find you in search and recommendations.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.profile.discoverable}
                onChange={(e) => updateSetting('profile', 'discoverable', e.target.checked)}
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
              <div className="setting-label">In-app alerts</div>
              <p className="setting-help">Badges and toasts for new messages and replies.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.inApp}
                onChange={(e) => updateSetting('notifications', 'inApp', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
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
              <div className="setting-label">Mentions</div>
              <p className="setting-help">Alert me when I am tagged in threads or comments.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.mentions}
                onChange={(e) => updateSetting('notifications', 'mentions', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Replies and votes</div>
              <p className="setting-help">Notify me when my posts get replies or vote swings.</p>
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
              <div className="setting-label">Community announcements</div>
              <p className="setting-help">Highlights from forums you follow.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.communityAnnouncements}
                onChange={(e) => updateSetting('notifications', 'communityAnnouncements', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Weekly digest</div>
              <p className="setting-help">Top posts and invites delivered once a week.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.weeklyDigest}
                onChange={(e) => updateSetting('notifications', 'weeklyDigest', e.target.checked)}
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
              <div className="setting-label">Session timeout</div>
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

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Trusted devices only</div>
              <p className="setting-help">Block sign-ins that skip device verification.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.security.trustedDevicesOnly}
                onChange={(e) => updateSetting('security', 'trustedDevicesOnly', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
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
              <div className="setting-label">Default feed</div>
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

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Autoplay media</div>
              <p className="setting-help">Mute gifs and videos until you tap.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.feed.autoplayMedia}
                onChange={(e) => updateSetting('feed', 'autoplayMedia', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Open links in new tab</div>
              <p className="setting-help">Keep your place in the feed when opening threads.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.feed.openLinksInNewTab}
                onChange={(e) => updateSetting('feed', 'openLinksInNewTab', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Followed communities first</div>
              <p className="setting-help">Prioritize threads from communities you follow.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.feed.filterFollowedCommunities}
                onChange={(e) => updateSetting('feed', 'filterFollowedCommunities', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Show campus events</div>
              <p className="setting-help">Include events and funding posts in your feed.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.feed.includeEvents}
                onChange={(e) => updateSetting('feed', 'includeEvents', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
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

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Show achievements</div>
              <p className="setting-help">Display badges such as ambassador or moderator roles.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.community.showAchievements}
                onChange={(e) => updateSetting('community', 'showAchievements', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-label">Hide sensitive content</div>
              <p className="setting-help">Blur media flagged by community moderators.</p>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.community.hideNSFW}
                onChange={(e) => updateSetting('community', 'hideNSFW', e.target.checked)}
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
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className={`session-item${session.current ? ' current' : ''}`}
              >
                <div className="session-meta">
                  <div className="setting-label">{session.device}</div>
                  <div className="setting-help">{session.location} · {session.lastActive}</div>
                </div>
                <div className="session-actions">
                  {session.trusted && <span className="settings-badge subtle">Trusted</span>}
                  {session.current ? (
                    <span className="settings-badge positive">This device</span>
                  ) : (
                    <button type="button" className="pill-button secondary small">
                      Sign out
                    </button>
                  )}
                </div>
              </div>
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

      <p className="settings-footnote">Settings are stored locally for now; wire these toggles to backend endpoints to persist per user.</p>
    </div>
  );
}

export default AccountSettings;
