// src/components/LeftSidebar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  BookOpenText,
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
  Database,
  Lightbulb
} from 'lucide-react';
import { isAdmin, isSuperAdmin } from '../constants/roles';
import { useLanguage } from '../i18n/LanguageContext';
import { REELS_ENABLED } from '../constants/features';

const baseItems = [
  { to: '/home', labelKey: 'nav.home', Icon: Home, color: '#2F80ED', key: 'home', sectionKey: 'nav.getHelp' },
  { to: '/info', labelKey: 'nav.guidesAnswers', Icon: BookOpenText, color: '#7656D9', key: 'info', sectionKey: 'nav.getHelp' },
  { to: '/communities', labelKey: 'nav.communities', Icon: Users, color: '#10B981', key: 'communities', sectionKey: 'nav.getHelp' },
  { to: '/events-feed', labelKey: 'nav.events', Icon: Calendar, color: '#14B8A6', key: 'events_feed', sectionKey: 'nav.getHelp' },
  { to: '/saved', labelKey: 'nav.saved', Icon: Bookmark, color: '#6366F1', key: 'saved', sectionKey: 'nav.getHelp' },
  { to: '/funding', labelKey: 'nav.funding', Icon: Medal, color: '#F59E0B', key: 'funding', sectionKey: 'nav.more' },
  { to: '/polls', labelKey: 'nav.polls', Icon: BarChart3, color: '#F97316', key: 'polls_feed', sectionKey: 'nav.more' },
  { to: '/reels', labelKey: 'nav.reels', Icon: Clapperboard, color: '#7656D9', key: 'reels', sectionKey: 'nav.more', comingSoon: !REELS_ENABLED },
  { to: '/connections', labelKey: 'nav.connections', Icon: UserCheck, color: '#EC4899', key: 'connections', sectionKey: 'nav.more' },
  { to: '/profile', labelKey: 'nav.myProfile', Icon: UserCircle, color: '#64748B', key: 'profile', sectionKey: 'nav.more' },
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
}) {
  const { t } = useLanguage();
  const roleId = userData?.role_id;
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAdminRole = isAdmin(roleId);
  const adminCommunityIds = Array.isArray(userData?.admin_community_ids) ? userData.admin_community_ids : [];
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const isAmbassador = userData && Number(userData.is_ambassador) === 1;
  const isModerator = userData && (isSuperAdminUser || isAmbassador);

  const items = [
    ...baseItems,
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
    ...(isAdminRole
      ? [{ to: '/admin/knowledge-gaps', labelKey: 'nav.knowledgeGaps', Icon: Lightbulb, color: '#F59E0B', key: 'knowledge_gaps', sectionKey: 'nav.manage' }]
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

  const renderItem = ({ to, labelKey, Icon, color, key, comingSoon }) => {
    const label = t(labelKey);
    const isLocked = !userData && lockedKeys.includes(key);
    const pendingCounts = {
      verifications: Number(pendingVerificationCount) || 0,
      reports: Number(pendingReportCount) || 0,
      connections: Number(pendingConnectionCount) || 0,
    };
    const pendingCount = pendingCounts[key] || 0;

    return (
      <li key={key}>
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
            {!isLocked && comingSoon && (
              <span className="lock-badge coming-soon-badge">{t('nav.comingSoon')}</span>
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
          <span className="sidebar-heading-kicker">{t('nav.studentSphere')}</span>
          <span className="sidebar-heading-title">{t('nav.helpCenter')}</span>
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
