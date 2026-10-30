import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const fundingResponse = {
  success: true,
  article_count: 3,
  groups: [
    {
      key: 'aid-basics',
      title: 'Financial aid essentials',
      description: 'Start with costs and aid offers.',
      articles: [
        {
          thread_id: 'thread-fafsa',
          forum_id: 'forum-aid',
          title: "FAFSA: Complete Beginner's Guide",
          content_kind: 'article',
          excerpt: 'A step-by-step overview of the federal aid application.',
        },
      ],
    },
    {
      key: 'student-loans',
      title: 'Student loans',
      description: 'Understand borrowing and repayment.',
      articles: [
        {
          thread_id: 'thread-loans',
          forum_id: 'forum-loans',
          title: 'Federal Student Loans Explained',
          content_kind: 'article',
          excerpt: 'Compare the main federal loan programs.',
        },
        {
          thread_id: 'thread-questions',
          forum_id: 'forum-aid',
          title: 'Financial Aid Questions Megathread',
          content_kind: 'megathread',
          excerpt: 'Ask general financial aid questions here.',
        },
      ],
    },
  ],
};

const renderFundingRoute = () => {
  const router = createMemoryRouter(
    [
      {
        path: '/funding',
        element: (
          <Feed
            activeFeed="explore"
            setActiveFeed={jest.fn()}
            activeSection="funding"
            userData={null}
            onRequireAuth={jest.fn()}
          />
        ),
      },
    ],
    { initialEntries: ['/funding'] }
  );

  return render(<RouterProvider router={router} />);
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) => {
    if (url === '/api/fetch_funding_articles.php?lang=en') {
      return Promise.resolve({ data: fundingResponse });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

test('lists funding articles with links to their original Information Board threads', async () => {
  renderFundingRoute();

  const fafsaLink = await screen.findByRole('link', {
    name: /FAFSA: Complete Beginner's Guide/i,
  });
  expect(fafsaLink).toHaveAttribute(
    'href',
    '/info/forum/forum-aid/thread/thread-fafsa'
  );
  expect(screen.getByText('3 guides live')).toBeInTheDocument();
  expect(screen.getByText('Community Q&A')).toBeInTheDocument();

  const helpNote = screen.getByText(/Need help applying a guide/i).closest('aside');
  expect(within(helpNote).getByRole('link')).toHaveAttribute(
    'href',
    '/info/forum/forum-aid/thread/thread-questions'
  );
});

test('filters the funding collection by article content', async () => {
  renderFundingRoute();
  await screen.findByText("FAFSA: Complete Beginner's Guide");

  fireEvent.change(screen.getByRole('searchbox', { name: /search funding guides/i }), {
    target: { value: 'federal loan programs' },
  });

  await waitFor(() => {
    expect(screen.getByText('Federal Student Loans Explained')).toBeInTheDocument();
    expect(screen.queryByText("FAFSA: Complete Beginner's Guide")).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });
});

test('starts funding sections collapsed on mobile and lets readers expand them', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: query === '(max-width: 720px)',
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  try {
    renderFundingRoute();

    const aidBasicsToggle = await screen.findByRole('button', {
      name: /Financial aid essentials/i,
    });
    expect(aidBasicsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', {
      name: /FAFSA: Complete Beginner's Guide/i,
    })).not.toBeInTheDocument();

    fireEvent.click(aidBasicsToggle);

    expect(aidBasicsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('link', {
      name: /FAFSA: Complete Beginner's Guide/i,
    })).toBeInTheDocument();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});
