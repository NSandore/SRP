import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntroReelCard } from './ReelGrid';

test('renders the owner Intro Reel prompt while the profile is still loading', () => {
  render(
    <MemoryRouter>
      <IntroReelCard profile={null} isOwner />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: /introduce yourself/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /add intro reel/i })).toHaveAttribute(
    'href',
    '/reels?compose=intro'
  );
});
