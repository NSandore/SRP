import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Feed from './Feed';

jest.mock('axios');
jest.mock('../hooks/useTagOptions', () => ({
  __esModule: true,
  default: () => ({ tags: [], loading: false }),
}));
jest.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    locale: 'en-US',
    t: (key) => key,
  }),
}));

const COMMUNITY_ENDPOINT_PATTERN = /^\/api\/fetch_all_(university|group)_data\.php/;

const communityRequests = () =>
  axios.get.mock.calls
    .filter(([url]) => COMMUNITY_ENDPOINT_PATTERN.test(url))
    .map(([url]) => {
      const parsed = new URL(url, 'http://localhost');
      return {
        kind: url.includes('_group_') ? 'group' : 'university',
        page: Number(parsed.searchParams.get('page')),
        scope: parsed.searchParams.get('scope'),
        sort: parsed.searchParams.get('sort'),
        query: parsed.searchParams.get('search'),
      };
    });

const lastCommunityRequest = () => {
  const requests = communityRequests();
  return requests[requests.length - 1];
};

const renderCommunitiesRoute = (entry) => {
  const router = createMemoryRouter(
    [
      {
        path: '/communities',
        element: (
          <Feed
            activeFeed="explore"
            setActiveFeed={jest.fn()}
            activeSection="communities"
            userData={null}
            onRequireAuth={jest.fn()}
          />
        ),
      },
    ],
    { initialEntries: [entry] }
  );

  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) => {
    if (!COMMUNITY_ENDPOINT_PATTERN.test(url)) {
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    }

    const parsed = new URL(url, 'http://localhost');
    const requestedPage = Math.max(1, Number(parsed.searchParams.get('page')) || 1);
    return Promise.resolve({
      data: {
        communities: [],
        current_page: requestedPage,
        total_count: 60,
        total_pages: 6,
      },
    });
  });
});

test('restores the community page and filter tuple after a refresh', async () => {
  const firstView = renderCommunitiesRoute(
    '/communities?kind=group&scope=unfollowed&sort=alpha&query=robotics&page=4'
  );

  // Wait through the search debounce so a delayed page-one request cannot
  // make a transient restoration look correct.
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  });

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('4');
    expect(lastCommunityRequest()).toEqual({
      kind: 'group',
      page: 4,
      scope: 'unfollowed',
      sort: 'alpha',
      query: 'robotics',
    });
    expect(communityRequests().every(({ page }) => page === 4)).toBe(true);
  });

  const refreshEntry =
    firstView.router.state.location.pathname + firstView.router.state.location.search;
  const refreshParams = new URLSearchParams(firstView.router.state.location.search);
  expect(Object.fromEntries(refreshParams)).toEqual(
    expect.objectContaining({
      kind: 'group',
      scope: 'unfollowed',
      sort: 'alpha',
      query: 'robotics',
      page: '4',
    })
  );

  const pageFourRequestsBeforeRefresh = communityRequests().filter(
    ({ page }) => page === 4
  ).length;
  firstView.unmount();

  renderCommunitiesRoute(refreshEntry);

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  });

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('4');
    expect(lastCommunityRequest()).toEqual({
      kind: 'group',
      page: 4,
      scope: 'unfollowed',
      sort: 'alpha',
      query: 'robotics',
    });
    expect(communityRequests().filter(({ page }) => page === 4).length).toBeGreaterThan(
      pageFourRequestsBeforeRefresh
    );
    expect(communityRequests().every(({ page }) => page === 4)).toBe(true);
  });
});

test('pushes community page jumps and restores them with Back and Forward', async () => {
  const { router } = renderCommunitiesRoute(
    '/communities?kind=university&scope=all&sort=popularity&page=2'
  );

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  });

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('2');
    expect(lastCommunityRequest()?.page).toBe(2);
  });

  fireEvent.change(screen.getByRole('textbox', { name: /page number/i }), {
    target: { value: '5' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^go$/i }));

  await waitFor(() => {
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('page')).toBe('5');
    expect(params.get('kind')).toBe('university');
    expect(params.get('scope')).toBe('all');
    expect(params.get('sort')).toBe('popularity');
    expect(lastCommunityRequest()?.page).toBe(5);
  });

  await act(async () => {
    await router.navigate(-1);
  });

  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('2');
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('2');
    expect(lastCommunityRequest()?.page).toBe(2);
  });

  await act(async () => {
    await router.navigate(1);
  });

  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('5');
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('5');
    expect(lastCommunityRequest()?.page).toBe(5);
  });
});
