// src/context/ProfileContactContext.js
//
// Lets a profile page (SelfProfileView / UserProfileView) publish its "Contact Me"
// content so RightSidebar can render it in the page's right rail, since the two
// components are siblings under AppShell rather than parent/child.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ProfileContactContext = createContext({ content: null, setContent: () => {} });

export function ProfileContactProvider({ children }) {
  const [content, setContent] = useState(null);
  const value = useMemo(() => ({ content, setContent }), [content]);
  return (
    <ProfileContactContext.Provider value={value}>
      {children}
    </ProfileContactContext.Provider>
  );
}

export function useProfileContactRailContent() {
  return useContext(ProfileContactContext).content;
}

// `renderContent` is a function returning a ReactNode; it is only invoked when
// `deps` changes, so callers should pass the primitive values the content depends
// on (not a freshly-created node/object) to avoid re-publishing on every render.
export function usePublishProfileContact(renderContent, deps) {
  const { setContent } = useContext(ProfileContactContext);
  useEffect(() => {
    setContent(renderContent());
    return () => setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
