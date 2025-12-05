import React, { useState } from 'react';
import './AppShell.css';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import ContactUsButton from '../components/ContactUsButton';
import NavBar from '../components/NavBar';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

type NavBarProps = any; // Narrow types later as needed

type AppShellProps = {
  children: React.ReactNode;
  navBarProps: NavBarProps;
  userData?: any;
  lockedNavKeys?: string[];
};

export default function AppShell({
  children,
  navBarProps,
  userData,
  lockedNavKeys,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const isWideLayout =
    pathname.startsWith('/communities') ||
    pathname.startsWith('/university') ||
    pathname.startsWith('/group') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/user/');
  const isMessagesRoute = pathname.startsWith('/messages');
  const isSearchRoute = pathname.startsWith('/search');
  const isSettingsRoute = pathname.startsWith('/settings');
  const effectiveLockedKeys = lockedNavKeys ?? ['saved', 'connections', 'profile'];

  return (
    <div className="app-shell">
      {/* TopBar */}
      <NavBar {...navBarProps} />

      {/* Drawer trigger for < lg */}
      <button
        type="button"
        className="drawer-toggle"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={drawerOpen}
        aria-controls="left-drawer"
      >
        <Menu size={18} /> Menu
      </button>

      {/* Drawer + backdrop (mobile) */}
      <div
        className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        id="left-drawer"
        className={`left-drawer ${drawerOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Navigation drawer"
      >
        <LeftSidebar userData={userData} lockedKeys={effectiveLockedKeys} />
      </aside>

      {/* Main three-column grid */}
      <main className="app-shell-main">
        <div
          className={`app-shell-grid ${sidebarCollapsed ? 'nav-collapsed' : ''} ${isWideLayout ? 'communities-layout' : ''} ${
            isMessagesRoute ? 'messages-layout' : ''
          } ${isSearchRoute ? 'search-layout' : ''} ${isSettingsRoute ? 'settings-layout' : ''}`}
        >
          <div className="left-rail">
            <LeftSidebar
              userData={userData}
              lockedKeys={effectiveLockedKeys}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />
          </div>
          <div className="center-rail">
            {children}
          </div>
          <div className="right-rail">
            <RightSidebar />
            <div style={{ marginTop: '1rem' }}>
              <ContactUsButton />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
