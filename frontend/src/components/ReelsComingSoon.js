import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import './ReelsComingSoon.css';

function ReelsComingSoon() {
  return (
    <div className="reels-coming-soon">
      <div className="reels-coming-soon__card">
        <span className="reels-coming-soon__icon" aria-hidden="true">
          <Clapperboard size={28} />
        </span>
        <span className="coming-soon-badge lock-badge">Coming soon</span>
        <h1 className="reels-coming-soon__title">Reels are coming soon</h1>
        <p className="reels-coming-soon__text">
          Short videos from students and communities are on the way. We&apos;re putting the
          finishing touches on them and will open them up soon.
        </p>
        <Link to="/home" className="reels-coming-soon__button">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default ReelsComingSoon;
