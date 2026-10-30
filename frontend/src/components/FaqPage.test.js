import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FaqPage from './FaqPage';

test('explains empty communities and links back to the directory', () => {
  render(
    <MemoryRouter>
      <FaqPage />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: /frequently asked questions/i })).toBeInTheDocument();
  expect(screen.getByText(/why does a community look empty/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /browse communities/i })).toHaveAttribute('href', '/communities');
});
