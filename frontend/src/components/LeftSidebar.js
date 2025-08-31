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
  UserCircle
} from 'lucide-react';

const items = [
  { to: '/home', label: 'Home', Icon: Home, color: '#2563EB', key: 'home' },
  { to: '/info', label: 'Info Board', Icon: Info, color: '#0EA5E9', key: 'info' },
  { to: '/funding', label: 'Funding', Icon: Medal, color: '#F59E0B', key: 'funding' },
  { to: '/communities', label: 'Communities', Icon: Users, color: '#10B981', key: 'communities' },
  { to: '/saved', label: 'Saved', Icon: Bookmark, color: '#6366F1', key: 'saved' },
  { to: '/connections', label: 'Connections', Icon: UserCheck, color: '#EC4899', key: 'connections' },
  { to: '/profile', label: 'My Profile', Icon: UserCircle, color: '#64748B', key: 'profile' },
];

function LeftSidebar() {
  return (
    <nav className="left-sidebar" aria-label="Primary">
      <ul className="sidebar-list">
        {items.map(({ to, label, Icon, color, key }) => (
          <li key={key}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
              aria-label={label}
            >
              <span
                className="icon-circle"
                style={{ backgroundColor: `${color}26`, color }}
                aria-hidden="true"
              >
                <Icon size={18} />
              </span>
              <span className="sidebar-text">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default LeftSidebar;
