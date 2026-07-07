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
  BarChart3
} from 'lucide-react';
import { isAdmin, isSuperAdmin } from '../constants/roles';

const baseItems = [
  { to: '/home', label: 'Home', Icon: Home, color: '#2563EB', key: 'home', section: 'Explore' },
  { to: '/info', label: 'Info Board', Icon: Info, color: '#0EA5E9', key: 'info', section: 'Explore' },
  { to: '/funding', label: 'Funding', Icon: Medal, color: '#F59E0B', key: 'funding', section: 'Explore' },
  { to: '/communities', label: 'Communities', Icon: Users, color: '#10B981', key: 'communities', section: 'Explore' },
  { to: '/saved', label: 'Saved', Icon: Bookmark, color: '#6366F1', key: 'saved', section: 'Your commons' },
  { to: '/connections', label: 'Connections', Icon: UserCheck, color: '#EC4899', key: 'connections', section: 'Your commons' },
  { to: '/profile', label: 'My Profile', Icon: UserCircle, color: '#64748B', key: 'profile', section: 'Your commons' },
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
  const roleId = userData?.role_id;
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAdminRole = isAdmin(roleId);
  const adminCommunityIds = Array.isArray(userData?.admin_community_ids) ? userData.admin_community_ids : [];
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const isAmbassador = userData && Number(userData.is_ambassador) === 1;
  const isModerator = userData && (isSuperAdminUser || isAmbassador);

  const mobileExtras = isDrawer ? [
    { to: '/events-feed', label: 'Events', Icon: Calendar, color: '#14B8A6', key: 'events_feed', section: 'Explore' },
    { to: '/polls', label: 'Polls', Icon: BarChart3, color: '#F97316', key: 'polls_feed', section: 'Explore' },
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
      ? [{ to: '/events', label: 'Event Management', Icon: CalendarRange, color: '#22C55E', key: 'events', section: 'Manage' }]
      : []),
    ...(isSuperAdminUser
      ? [{ to: '/admin/verifications', label: 'Verifications', Icon: ShieldCheck, color: '#0EA5E9', key: 'verifications', section: 'Manage' }]
      : []),
    ...(isModerator
      ? [{ to: '/reports', label: 'Reported Items', Icon: Flag, color: '#F43F5E', key: 'reports', section: 'Manage' }]
      : []),
  ];

  const sections = items.reduce((groups, item) => {
    const sectionName = item.section || 'Explore';
    const existingGroup = groups.find((group) => group.name === sectionName);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ name: sectionName, items: [item] });
    }
    return groups;
  }, []);

  const renderItem = ({ to, label, Icon, color, key }) => {
    const isLocked = !userData && lockedKeys.includes(key);
    const isComingSoon = key === 'funding';
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
                Locked
              </span>
            )}
            {isComingSoon && (
              <span className="lock-badge coming-soon-badge">
                Coming soon
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <span className="sidebar-count" aria-label={`${pendingCount} pending ${label.toLowerCase()}`}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <nav className={`left-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Primary">
      <div className="sidebar-heading">
        <div className="sidebar-heading-copy" aria-hidden={collapsed}>
          <span className="sidebar-heading-kicker">Academic commons</span>
          <span className="sidebar-heading-title">Campus index</span>
        </div>
        {onToggle && (
          <div className="sidebar-toggle-container">
          <button
            type="button"
            className="sidebar-toggle-button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          </div>
        )}
      </div>
      <div className="sidebar-sections">
        {sections.map((section) => (
          <section className="sidebar-section" key={section.name} aria-label={section.name}>
            <div className="sidebar-section-label">{section.name}</div>
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
