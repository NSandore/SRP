import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import InstitutionDataReview from './InstitutionDataReview';

jest.mock('axios');

const REVIEW_ENDPOINT = '/api/fetch_institution_reviews.php';
const SUPER_ADMIN = { user_id: 1, role_id: 5 };

const reviewRequestPages = () =>
  axios.get.mock.calls
    .filter(([url]) => url === REVIEW_ENDPOINT)
    .map(([, options]) => Number(options?.params?.page));

const lastReviewRequestPage = () => {
  const pages = reviewRequestPages();
  return pages[pages.length - 1];
};

const lastReviewRequestParams = () => {
  const requests = axios.get.mock.calls.filter(([url]) => url === REVIEW_ENDPOINT);
  return requests[requests.length - 1]?.[1]?.params;
};

const renderReviewRoute = (entry) => {
  const router = createMemoryRouter(
    [
      {
        path: '/admin/institutions',
        element: <InstitutionDataReview userData={SUPER_ADMIN} />,
      },
    ],
    { initialEntries: [entry] }
  );

  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url, options = {}) => {
    if (url !== REVIEW_ENDPOINT) {
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    }

    const requestedPage = Math.max(1, Number(options.params?.page) || 1);
    return Promise.resolve({
      data: {
        reviews: [],
        pagination: {
          total: 150,
          page: requestedPage,
          total_pages: 5,
        },
      },
    });
  });
});

test('hydrates the institution review page from the URL after a refresh', async () => {
  const firstView = renderReviewRoute(
    '/admin/institutions?status=failed&q=hartford&page=4'
  );

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('4');
    expect(lastReviewRequestPage()).toBe(4);
  });

  // The search debounce runs shortly after mount. Waiting through it ensures
  // restored pagination is not only a transient pre-debounce state.
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  });

  expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('4');
  expect(lastReviewRequestPage()).toBe(4);
  expect(reviewRequestPages().every((page) => page === 4)).toBe(true);
  expect(lastReviewRequestParams()).toEqual(
    expect.objectContaining({ page: 4, status: 'failed', q: 'hartford' })
  );

  const refreshEntry =
    firstView.router.state.location.pathname + firstView.router.state.location.search;
  const refreshParams = new URLSearchParams(firstView.router.state.location.search);
  expect(refreshParams.get('page')).toBe('4');
  expect(refreshParams.get('status')).toBe('failed');
  expect(refreshParams.get('q')).toBe('hartford');

  const pageFourRequestsBeforeRefresh = reviewRequestPages().filter((page) => page === 4).length;
  firstView.unmount();

  renderReviewRoute(refreshEntry);

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  });

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('4');
    expect(lastReviewRequestParams()).toEqual(
      expect.objectContaining({ page: 4, status: 'failed', q: 'hartford' })
    );
    expect(reviewRequestPages().filter((page) => page === 4).length).toBeGreaterThan(
      pageFourRequestsBeforeRefresh
    );
    expect(reviewRequestPages().every((page) => page === 4)).toBe(true);
  });
});

test('pushes page jumps into history and restores them with Back and Forward', async () => {
  const { router } = renderReviewRoute('/admin/institutions?page=2');

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('2');
    expect(lastReviewRequestPage()).toBe(2);
  });

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  });
  expect(lastReviewRequestPage()).toBe(2);

  fireEvent.change(screen.getByRole('textbox', { name: /page number/i }), {
    target: { value: '5' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^go$/i }));

  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('5');
    expect(lastReviewRequestPage()).toBe(5);
  });

  await act(async () => {
    await router.navigate(-1);
  });

  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('2');
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('2');
    expect(lastReviewRequestPage()).toBe(2);
  });

  await act(async () => {
    await router.navigate(1);
  });

  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('5');
    expect(screen.getByRole('textbox', { name: /page number/i })).toHaveValue('5');
    expect(lastReviewRequestPage()).toBe(5);
  });
});
