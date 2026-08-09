import React, { useCallback, useEffect, useState } from 'react';
import './AppShell.css';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import ContactUsButton from '../components/ContactUsButton';
import AppFooterLinks from './AppFooterLinks';
import { ProfileContactProvider } from '../context/ProfileContactContext';
import NavBar from '../components/NavBar';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { isSuperAdmin } from '../constants/roles';

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
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const [pendingConnectionCount, setPendingConnectionCount] = useState(0);
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
  const isDonateRoute = pathname.startsWith('/donate');
  const isReelsRoute = pathname === '/reels' || pathname.startsWith('/reels/');
  const isHomeRoute = pathname === '/home';
  const isCommunityProfileRoute = /^\/(university|group)\/[^/]+/.test(pathname);
  const isInfoRoute = pathname === '/info' || pathname.startsWith('/info/');
  const isFundingRoute = pathname === '/funding' || pathname.startsWith('/funding/');
  const areaClass = isHomeRoute
    ? 'area-home'
    : isInfoRoute
      ? 'area-info'
      : isFundingRoute
        ? 'area-funding'
        : isCommunityProfileRoute
          ? 'area-community'
          : '';
  // Saved, Connections, Events, management workspaces, and Reported Items have no
  // content for the right rail, so let the center rail claim that column's width.
  const NO_RIGHT_RAIL_PATHS = [
    '/saved',
    '/connections',
    '/events-feed',
    '/events',
    '/admin/verifications',
    '/admin/newsroom',
    '/reports',
    // Documents and admin workspaces read as full-width pages: the rail's
    // feed-oriented widgets are noise beside them.
    '/changelog',
    '/privacy',
    '/terms',
    '/admin/changelog',
    '/admin/institutions',
  ];
  const isNoRightRailRoute = NO_RIGHT_RAIL_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const effectiveLockedKeys = lockedNavKeys ?? ['saved', 'connections', 'profile', 'polls_feed'];

  const [announcementHeight, setAnnouncementHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    const loadPendingCounts = async () => {
      if (!userData?.user_id) {
        if (!cancelled) {
          setPendingVerificationCount(0);
          setPendingReportCount(0);
          setPendingConnectionCount(0);
        }
        return;
      }

      const canReviewVerifications = isSuperAdmin(userData?.role_id);
      const canReviewReports = canReviewVerifications || Number(userData?.is_ambassador) === 1;
      const requests = [
        axios.get('/api/fetch_connection_request_count.php', { withCredentials: true }),
        canReviewVerifications
          ? axios.get('/api/fetch_verification_request_count.php', { withCredentials: true })
          : Promise.resolve(null),
        canReviewReports
          ? axios.get('/api/fetch_reported_item_count.php', { withCredentials: true })
          : Promise.resolve(null),
      ];
      const [connectionsResult, verificationsResult, reportsResult] = await Promise.allSettled(requests);
      if (cancelled) return;

      setPendingConnectionCount(
        connectionsResult.status === 'fulfilled'
          ? Number(connectionsResult.value?.data?.pending_count || 0)
          : 0
      );
      setPendingVerificationCount(
        verificationsResult.status === 'fulfilled'
          ? Number(verificationsResult.value?.data?.pending_count || 0)
          : 0
      );
      setPendingReportCount(
        reportsResult.status === 'fulfilled'
          ? Number(reportsResult.value?.data?.pending_count || 0)
          : 0
      );
    };

    loadPendingCounts();
    intervalId = window.setInterval(loadPendingCounts, 60000);
    window.addEventListener('sidebarCountsUpdated', loadPendingCounts);
    return () => {
      cancelled = true;
      window.removeEventListener('sidebarCountsUpdated', loadPendingCounts);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [pathname, userData?.is_ambassador, userData?.role_id, userData?.user_id]);

  // Listen for announcement bar height changes from NavBar
  const handleAnnouncementHeight = useCallback((height: number) => {
    setAnnouncementHeight((prev) => (prev === height ? prev : height));
  }, []);

  return (
    <div className={`app-shell home-shell scholarly-shell${areaClass ? ` ${areaClass}` : ''}`}>
      {/* TopBar */}
      <NavBar
        {...navBarProps}
        onOpenDrawer={() => setDrawerOpen(true)}
        onCloseDrawer={() => setDrawerOpen(false)}
        isDrawerOpen={drawerOpen}
        onAnnouncementHeight={handleAnnouncementHeight}
      />

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
        <LeftSidebar
          userData={userData}
          lockedKeys={effectiveLockedKeys}
          pendingVerificationCount={pendingVerificationCount}
          pendingReportCount={pendingReportCount}
          pendingConnectionCount={pendingConnectionCount}
          onNavigate={() => setDrawerOpen(false)}
          isDrawer
        />
      </aside>

      {/* Main three-column grid */}
      <main className="app-shell-main" style={{ paddingTop: announcementHeight ? `${announcementHeight}px` : undefined }}>
        <div
          className={`app-shell-grid ${sidebarCollapsed ? 'nav-collapsed' : ''} ${isHomeRoute ? 'home-layout' : ''} ${isWideLayout ? 'communities-layout' : ''} ${
            isMessagesRoute ? 'messages-layout' : ''
          } ${isSearchRoute ? 'search-layout' : ''} ${isSettingsRoute ? 'settings-layout' : ''} ${isDonateRoute ? 'donate-layout' : ''} ${
            isNoRightRailRoute ? 'no-right-rail-layout' : ''
          } ${isReelsRoute ? 'reels-layout' : ''}`}
        >
          <div className="left-rail" data-tour="primary-nav">
            <LeftSidebar
              userData={userData}
              lockedKeys={effectiveLockedKeys}
              collapsed={sidebarCollapsed}
              pendingVerificationCount={pendingVerificationCount}
              pendingReportCount={pendingReportCount}
              pendingConnectionCount={pendingConnectionCount}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />
          </div>
          <ProfileContactProvider>
            <div className="center-rail" data-tour="feed">
              {/* Wrapper grows to fill any spare height so the footer links sit
                  on the bottom edge of a short page instead of floating
                  mid-screen, and are pushed below the content on a long one. */}
              <div className="center-rail__content">{children}</div>
              <AppFooterLinks />
            </div>
            <div className="right-rail">
              <RightSidebar userData={userData} />
              {!isCommunityProfileRoute && (
                <div style={{ marginTop: '1rem' }}>
                  <ContactUsButton />
                </div>
              )}
            </div>
          </ProfileContactProvider>
        </div>
      </main>
    </div>
  );
}
