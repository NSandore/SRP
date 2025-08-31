import React from 'react';
import TrendingThreads from './TrendingThreads';
import UpcomingWebinars from './UpcomingWebinars';
import PollOfTheDay from './PollOfTheDay';

export default function RightRail() {
  return (
    <div className="right-rail-stack">
      <TrendingThreads />
      <UpcomingWebinars />
      <PollOfTheDay />
    </div>
  );
}

