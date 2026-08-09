import React from 'react';
import { Link } from 'react-router-dom';
import './AppFooterLinks.css';

/**
 * Quiet legal/product links under the centre rail.
 *
 * Kept as plain hyperlink text rather than a full footer so it does not compete
 * with feed content, and rendered inside the centre column so it scrolls away
 * with the page instead of pinning to the viewport.
 */
function AppFooterLinks() {
  return (
    <nav className="app-footer-links" aria-label="Site information">
      <Link to="/changelog">Changelog</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy">Privacy Policy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms">Terms of Service</Link>
    </nav>
  );
}

export default AppFooterLinks;
