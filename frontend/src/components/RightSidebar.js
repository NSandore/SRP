// src/components/RightSidebar.js
import React from 'react';
import { useLocation } from 'react-router-dom';
import RightRail from '../widgets/RightRail';
import ThreadRightRail from './ThreadRightRail';

function RightSidebar({ userData }) {
  const location = useLocation();
  const isThreadView = /\/thread\//.test(location.pathname);
  const isDonateRoute = location.pathname.startsWith('/donate');
  if (isDonateRoute) {
    return null;
  }
  return (
    <aside className="right-sidebar">
      {isThreadView ? <ThreadRightRail /> : <RightRail userData={userData} />}
    </aside>
  );
}

export default RightSidebar;
