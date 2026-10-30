import { render, screen } from '@testing-library/react';
import axios from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ThreadView from './ThreadView';

jest.mock('axios');
jest.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

const thread = {
  thread_id: 'thread-guide',
  forum_id: 'forum-info',
  community_id: 'c57b7fd6c45b9d57b',
  community_type: 'group',
  forum_name: 'Information Board',
  title: 'Understanding College',
  content_kind: 'guide',
  is_system_container: 1,
  is_locked: 1,
  created_at: '2026-08-01 12:00:00',
  updated_at: '2026-08-01 12:00:00',
  tags: [],
};

const rootPost = {
  post_id: 'post-guide',
  thread_id: 'thread-guide',
  user_id: 'seed-author',
  first_name: 'Seed',
  last_name: 'Author',
  avatar_path: null,
  content: '<p>Browse the Understanding College topics in the START HERE — Student Guide. Choose an article below for focused guidance.</p>',
  created_at: '2026-08-01 12:00:00',
  updated_at: '2026-08-01 12:00:00',
  upvotes: 0,
  downvotes: 0,
  verified: 0,
  reply_to: null,
};

let threadResponse;
let postsResponse;

const renderThreadRoute = () => {
  const router = createMemoryRouter(
    [
      {
        path: '/info/forum/:forum_id/thread/:thread_id',
        element: <ThreadView userData={null} onRequireAuth={jest.fn()} />,
      },
    ],
    { initialEntries: ['/info/forum/forum-info/thread/thread-guide'] }
  );

  return render(<RouterProvider router={router} />);
};

beforeEach(() => {
  jest.clearAllMocks();
  threadResponse = thread;
  postsResponse = [rootPost];
  axios.get.mockImplementation((url) => {
    if (url === '/api/fetch_thread.php?thread_id=thread-guide&lang=en') {
      return Promise.resolve({ data: threadResponse });
    }
    if (url === '/api/fetch_posts.php?thread_id=thread-guide&lang=en') {
      return Promise.resolve({ data: postsResponse });
    }
    if (url === '/api/fetch_knowledge_base_nodes.php?community_id=c57b7fd6c45b9d57b&parent_thread_id=thread-guide&lang=en') {
      return Promise.resolve({ data: { success: true, nodes: [] } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

test('renders Information Board root copy as a document without an individual author', async () => {
  renderThreadRoute();

  expect(await screen.findByText(/Browse the Understanding College topics/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Student guide content')).toHaveClass('knowledge-base-original');
  expect(screen.queryByRole('link', { name: 'Seed A.' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /upvote/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /post actions/i })).not.toBeInTheDocument();
});

test('keeps author attribution and post controls on ordinary discussions', async () => {
  threadResponse = {
    ...thread,
    title: 'Ordinary discussion',
    content_kind: 'discussion',
    is_system_container: '0',
    is_locked: 0,
  };

  renderThreadRoute();

  expect(await screen.findByRole('link', { name: 'Seed A.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /upvote/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /post actions/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/knowledge base/i)).not.toBeInTheDocument();
});
