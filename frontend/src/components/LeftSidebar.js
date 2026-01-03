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
  ChevronLeft,
  ChevronRight,
  Flag,
  CalendarRange
} from 'lucide-react';

const baseItems = [
  { to: '/home', label: 'Home', Icon: Home, color: '#2563EB', key: 'home' },
  { to: '/info', label: 'Info Board', Icon: Info, color: '#0EA5E9', key: 'info' },
  { to: '/funding', label: 'Funding', Icon: Medal, color: '#F59E0B', key: 'funding' },
  { to: '/communities', label: 'Communities', Icon: Users, color: '#10B981', key: 'communities' },
  { to: '/saved', label: 'Saved', Icon: Bookmark, color: '#6366F1', key: 'saved' },
  { to: '/connections', label: 'Connections', Icon: UserCheck, color: '#EC4899', key: 'connections' },
  { to: '/profile', label: 'My Profile', Icon: UserCircle, color: '#64748B', key: 'profile' },
];

function LeftSidebar({
  userData,
  lockedKeys = ['saved', 'connections', 'profile'],
  collapsed = false,
  onToggle = undefined,
  onNavigate = undefined,
}) {
  const isSuperAdmin = userData && Number(userData.role_id) === 1;
  const adminCommunityIds = Array.isArray(userData?.admin_community_ids) ? userData.admin_community_ids : [];
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const isModerator = userData && (isSuperAdmin || Number(userData.is_ambassador) === 1);

  const items = [
    ...baseItems,
    ...(isSuperAdmin || isCommunityAdmin
      ? [{ to: '/events', label: 'Event Management', Icon: CalendarRange, color: '#22C55E', key: 'events' }]
      : []),
    ...(isModerator
      ? [{ to: '/reports', label: 'Reported Items', Icon: Flag, color: '#F43F5E', key: 'reports' }]
      : []),
  ];

  return (
    <nav className={`left-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Primary">
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
      <ul className="sidebar-list">
        {items.map(({ to, label, Icon, color, key }) => {
          const isLocked = !userData && lockedKeys.includes(key);
          const isComingSoon = key === 'funding';
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
                title={label}
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
                      Coming Soon...
                    </span>
                  )}
                </div>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default LeftSidebar;
