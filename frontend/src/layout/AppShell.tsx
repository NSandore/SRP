import React, { useState } from 'react';
import './AppShell.css';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import ContactUsButton from '../components/ContactUsButton';
import NavBar from '../components/NavBar';
import { Menu } from 'lucide-react';

type NavBarProps = any; // Narrow types later as needed

type AppShellProps = {
  children: React.ReactNode;
  navBarProps: NavBarProps;
};

export default function AppShell({ children, navBarProps }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <LeftSidebar />
      </aside>

      {/* Main three-column grid */}
      <main className="app-shell-main">
        <div className="app-shell-grid">
          <div className="left-rail">
            <LeftSidebar />
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

