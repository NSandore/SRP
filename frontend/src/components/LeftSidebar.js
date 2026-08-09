// src/components/LeftSidebar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Info,
  Medal,
  Users,
  Bookmark,
  UserCheck,
  UserCircle,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Flag,
  CalendarRange,
  Calendar,
  BarChart3,
  Megaphone,
  Newspaper,
  Clapperboard,
  Database
} from 'lucide-react';
import { isAdmin, isSuperAdmin } from '../constants/roles';
import { useLanguage } from '../i18n/LanguageContext';

const baseItems = [
  { to: '/home', labelKey: 'nav.home', Icon: Home, color: '#2F80ED', key: 'home', sectionKey: 'nav.explore' },
  { to: '/reels', labelKey: 'nav.reels', Icon: Clapperboard, color: '#7656D9', key: 'reels', sectionKey: 'nav.explore' },
  { to: '/info', labelKey: 'nav.infoBoard', Icon: Info, color: '#69A8F7', key: 'info', sectionKey: 'nav.explore' },
  { to: '/funding', labelKey: 'nav.funding', Icon: Medal, color: '#F59E0B', key: 'funding', sectionKey: 'nav.explore' },
  { to: '/communities', labelKey: 'nav.communities', Icon: Users, color: '#10B981', key: 'communities', sectionKey: 'nav.explore' },
  { to: '/saved', labelKey: 'nav.saved', Icon: Bookmark, color: '#6366F1', key: 'saved', sectionKey: 'nav.yourCommons' },
  { to: '/connections', labelKey: 'nav.connections', Icon: UserCheck, color: '#EC4899', key: 'connections', sectionKey: 'nav.yourCommons' },
  { to: '/profile', labelKey: 'nav.myProfile', Icon: UserCircle, color: '#64748B', key: 'profile', sectionKey: 'nav.yourCommons' },
];

function LeftSidebar({
  userData,
  lockedKeys = ['saved', 'connections', 'profile', 'polls_feed'],
  collapsed = false,
  pendingVerificationCount = 0,
  pendingReportCount = 0,
  pendingConnectionCount = 0,
  onToggle = undefined,
  onNavigate = undefined,
  isDrawer = false,
}) {
  const { t } = useLanguage();
  const roleId = userData?.role_id;
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAdminRole = isAdmin(roleId);
  const adminCommunityIds = Array.isArray(userData?.admin_community_ids) ? userData.admin_community_ids : [];
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const isAmbassador = userData && Number(userData.is_ambassador) === 1;
  const isModerator = userData && (isSuperAdminUser || isAmbassador);

  const mobileExtras = isDrawer ? [
    { to: '/events-feed', labelKey: 'nav.events', Icon: Calendar, color: '#14B8A6', key: 'events_feed', sectionKey: 'nav.explore' },
    { to: '/polls', labelKey: 'nav.polls', Icon: BarChart3, color: '#F97316', key: 'polls_feed', sectionKey: 'nav.explore' },
  ] : [];
  const baseWithMobile = [...baseItems];
  if (mobileExtras.length) {
    const insertAt = baseWithMobile.findIndex((item) => item.key === 'communities');
    const idx = insertAt === -1 ? baseWithMobile.length : insertAt + 1;
    baseWithMobile.splice(idx, 0, ...mobileExtras);
  }

  const items = [
    ...baseWithMobile,
    ...(isSuperAdminUser || isAdminRole || isCommunityAdmin || isAmbassador
      ? [{ to: '/events', labelKey: 'nav.eventManagement', Icon: CalendarRange, color: '#22C55E', key: 'events', sectionKey: 'nav.manage' }]
      : []),
    ...(isSuperAdminUser
      ? [
          { to: '/admin/verifications', labelKey: 'nav.verifications', Icon: ShieldCheck, color: '#69A8F7', key: 'verifications', sectionKey: 'nav.manage' },
          { to: '/admin/institutions', labelKey: 'nav.institutionData', Icon: Database, color: '#4AA67B', key: 'institution_data', sectionKey: 'nav.manage' },
          { to: '/admin/newsroom', labelKey: 'nav.newsroom', Icon: Newspaper, color: '#2F80ED', key: 'newsroom', sectionKey: 'nav.manage' },
          { to: '/admin/changelog', labelKey: 'nav.changelog', Icon: Megaphone, color: '#A855F7', key: 'changelog', sectionKey: 'nav.manage' },
        ]
      : []),
    ...(isModerator
      ? [{ to: '/reports', labelKey: 'nav.reportedItems', Icon: Flag, color: '#F43F5E', key: 'reports', sectionKey: 'nav.manage' }]
      : []),
  ];

  const sections = items.reduce((groups, item) => {
    const sectionKey = item.sectionKey || 'nav.explore';
    const existingGroup = groups.find((group) => group.key === sectionKey);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ key: sectionKey, items: [item] });
    }
    return groups;
  }, []);

  const renderItem = ({ to, labelKey, Icon, color, key }) => {
    const label = t(labelKey);
    const isLocked = !userData && lockedKeys.includes(key);
    const isComingSoon = key === 'funding';
    const pendingCounts = {
      verifications: Number(pendingVerificationCount) || 0,
      reports: Number(pendingReportCount) || 0,
      connections: Number(pendingConnectionCount) || 0,
    };
    const pendingCount = pendingCounts[key] || 0;

    return (
      <li key={key} data-tour={key === 'communities' ? 'communities' : undefined}>
        <NavLink
          to={to}
          className={({ isActive }) => {
            let classes = `sidebar-link${isActive ? ' active' : ''}`;
            if (isLocked) classes += ' locked';
            return classes;
          }}
          aria-label={label}
          aria-disabled={isLocked}
          title={collapsed ? label : undefined}
          onClick={() => {
            if (!isLocked && onNavigate) onNavigate();
          }}
        >
          <span
            className="icon-circle sidebar-icon"
            style={{ backgroundColor: `${color}26`, color }}
            aria-hidden="true"
          >
            <Icon size={18} />
          </span>
          <div className="sidebar-text-group">
            <span className="sidebar-text">{label}</span>
            {isLocked && (
              <span className="lock-badge">
                <Lock size={12} />
                {t('nav.locked')}
              </span>
            )}
            {isComingSoon && (
              <span className="lock-badge coming-soon-badge">
                {t('nav.comingSoon')}
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <span className="sidebar-count" aria-label={t('nav.pendingItems', { count: pendingCount, label: label.toLowerCase() })}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <nav className={`left-sidebar${collapsed ? ' collapsed' : ''}`} aria-label={t('nav.primary')}>
      <div className="sidebar-heading">
        <div className="sidebar-heading-copy" aria-hidden={collapsed}>
          <span className="sidebar-heading-kicker">{t('nav.academicCommons')}</span>
          <span className="sidebar-heading-title">{t('nav.campusIndex')}</span>
        </div>
        {onToggle && (
          <div className="sidebar-toggle-container">
          <button
            type="button"
            className="sidebar-toggle-button"
            onClick={onToggle}
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            aria-pressed={collapsed}
            title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          </div>
        )}
      </div>
      <div className="sidebar-sections">
        {sections.map((section) => (
          <section className="sidebar-section" key={section.key} aria-label={t(section.key)}>
            <div className="sidebar-section-label">{t(section.key)}</div>
            <ul className="sidebar-list">
              {section.items.map(renderItem)}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

export default LeftSidebar;
