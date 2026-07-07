// src/components/RightSidebar.js
import React from 'react';
import { useLocation } from 'react-router-dom';
import RightRail from '../widgets/RightRail';
import ThreadRightRail from './ThreadRightRail';
import { useProfileContactRailContent } from '../context/ProfileContactContext';

// Pages where the generic "Upcoming Events" / "Polls" widgets are allowed to show.
// Everywhere else (including all "Your Commons" and "Manage" pages) hides them.
const GENERIC_WIDGET_PATHS = ['/home', '/info', '/funding', '/communities'];

function RightSidebar({ userData }) {
  const location = useLocation();
  const pathname = location.pathname;
  const isThreadView = /\/thread\//.test(pathname);
  const isDonateRoute = pathname.startsWith('/donate');
  const communityMatch = pathname.match(/^\/(university|group)\/([^/]+)/);
  const communityContext = communityMatch
    ? {
        type: communityMatch[1],
        id: decodeURIComponent(communityMatch[2]),
      }
    : null;
  const profileContactContent = useProfileContactRailContent();
  if (isDonateRoute) {
    return null;
  }
  const isGenericWidgetPage = GENERIC_WIDGET_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const hideGenericWidgets = !communityContext && !isGenericWidgetPage;
  return (
    <aside className="right-sidebar">
      {profileContactContent && (
        <section className="widget-card profile-contact-widget" aria-labelledby="profile-contact-rail-header">
          <div id="profile-contact-rail-header" className="widget-header compact-widget-header">
            <h3 className="widget-title">Contact Me</h3>
          </div>
          <div className="widget-body community-contact-list">
            {profileContactContent}
          </div>
        </section>
      )}
      {isThreadView
        ? <ThreadRightRail />
        : (
          <RightRail
            userData={userData}
            communityContext={communityContext}
            hideGenericWidgets={hideGenericWidgets}
          />
        )}
    </aside>
  );
}

export default RightSidebar;
