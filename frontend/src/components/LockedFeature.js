import React from 'react';
import './LockedFeature.css';
import { FaLock, FaRegBookmark, FaUserFriends, FaUserCircle } from 'react-icons/fa';

function LockedFeature({ feature = 'this feature', onLogin, onSignUp }) {
  const highlights = [
    { icon: <FaRegBookmark />, label: 'Save threads & posts for later' },
    { icon: <FaUserFriends />, label: 'Grow your network and chat directly' },
    { icon: <FaUserCircle />, label: 'Build a rich profile others can see' },
  ];

  return (
    <div className="locked-feature-wrapper">
      <div className="locked-feature-card">
        <div className="locked-icon-circle">
          <FaLock />
        </div>
        <p className="locked-chip">Members only</p>
        <h2>{feature} is locked</h2>
        <p className="locked-description">
          Create a free StudentSphere account or sign back in to unlock personalized tools
          like saved collections, your connections list, and rich profile insights.
        </p>
        <div className="locked-highlights">
          {highlights.map(({ icon, label }) => (
            <div key={label} className="locked-highlight">
              <span className="locked-highlight-icon">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="locked-actions">
          <button className="locked-button primary" onClick={onSignUp}>
            Create free account
          </button>
          <button className="locked-button ghost" onClick={onLogin}>
            Log in instead
          </button>
        </div>
      </div>
    </div>
  );
}

export default LockedFeature;
