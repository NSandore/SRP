import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ProductTour from './ProductTour';

jest.mock('axios');

const rect = (top, left, width, height) => ({
  top,
  left,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
});

const addTarget = (fixture, { tour, className, bounds, hidden = false }) => {
  const node = document.createElement('div');
  if (tour) node.dataset.tour = tour;
  if (className) node.className = className;
  if (hidden) node.style.visibility = 'hidden';
  node.getBoundingClientRect = jest.fn(() => bounds);
  node.scrollIntoView = jest.fn();
  fixture.appendChild(node);
  return node;
};

let fixture;

beforeEach(() => {
  jest.clearAllMocks();
  fixture = document.createElement('div');
  document.body.appendChild(fixture);
  axios.get.mockResolvedValue({
    data: { tour: { eligible: true, current_step: 0 } },
  });
  axios.post.mockResolvedValue({ data: { success: true } });
});

afterEach(() => {
  fixture.remove();
});

test('uses the visible Communities target when a hidden copy appears first', async () => {
  addTarget(fixture, { tour: 'feed', bounds: rect(40, 260, 700, 500) });
  addTarget(fixture, { tour: 'primary-nav', bounds: rect(80, 20, 210, 580) });
  addTarget(fixture, { tour: 'search', bounds: rect(12, 330, 360, 42) });
  addTarget(fixture, {
    tour: 'communities',
    bounds: rect(100, -320, 220, 48),
    hidden: true,
  });
  const visibleCommunities = addTarget(fixture, {
    tour: 'communities',
    bounds: rect(150, 280, 240, 76),
  });
  addTarget(fixture, {
    className: 'contact-us-button',
    bounds: rect(650, 910, 90, 40),
  });

  render(<ProductTour userData={{ user_id: 'u-test' }} />);

  expect(await screen.findByRole('heading', { name: /your home base/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(await screen.findByRole('heading', { name: /everything is close by/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(await screen.findByRole('heading', { name: /looking for something/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));

  expect(await screen.findByRole('heading', { name: /find your people/i })).toBeInTheDocument();
  await waitFor(() => {
    expect(document.querySelector('.product-tour__spotlight')).toHaveStyle({
      top: '144px',
      left: '274px',
      width: '252px',
      height: '88px',
    });
  });
  expect(visibleCommunities.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByRole('progressbar', { name: /tour progress/i })).toHaveAttribute('aria-valuenow', '4');
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/api/tour_action.php'),
    { action: 'advance', current_step: 3 },
    { withCredentials: true }
  );
});

test('skips a step when its only target is hidden', async () => {
  addTarget(fixture, { tour: 'feed', bounds: rect(40, 260, 700, 500) });
  addTarget(fixture, {
    tour: 'communities',
    bounds: rect(100, -320, 220, 48),
    hidden: true,
  });

  render(<ProductTour userData={{ user_id: 'u-test' }} />);

  expect(await screen.findByRole('progressbar', { name: /tour progress/i })).toHaveAttribute('aria-valuemax', '1');
  expect(screen.queryByRole('heading', { name: /find your people/i })).not.toBeInTheDocument();
});
