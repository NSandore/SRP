import React from 'react';
import { getAmbassadorSpecialtyLabel } from './signupOptions';

function AmbassadorSpecialtyBadges({ specialties = [], limit = 3 }) {
  const visible = Array.isArray(specialties) ? specialties.slice(0, limit) : [];
  if (!visible.length) return null;

  return (
    <div className="ambassador-specialty-badges" aria-label="Ambassador specialties">
      {visible.map((specialty) => (
        <span key={specialty}>{getAmbassadorSpecialtyLabel(specialty)}</span>
      ))}
    </div>
  );
}

export default AmbassadorSpecialtyBadges;
