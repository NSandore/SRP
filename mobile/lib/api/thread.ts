import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/api/types';

export type ThreadData = {
  thread_id: string;
  forum_id: string;
  community_id?: string;
  community_type?: string;
  forum_name?: string;
  community_name?: string;
  parent_community_id?: string | null;
  parent_thread_id?: string | null;
  parent_thread_title?: string | null;
  is_system_container?: number | string;
  content_kind?: 'discussion' | 'article' | 'megathread' | 'guide' | 'section';
  sort_order?: number | string;
  is_locked?: number | string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  updated_by_first_name?: string;
  updated_by_last_name?: string;
  user_vote?: string | null;
  upvotes?: number | string;
  downvotes?: number | string;
  first_name?: string;
  last_name?: string;
  creator_avatar_path?: string;
  author_verified?: number | string;
  is_connection?: number | string;
  user_role?: string | null;
  ambassador_logo_path?: string | null;
  tags?: string[];
};

export type PostData = {
  post_id: string;
  thread_id: string;
  user_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  upvotes?: number | string;
  downvotes?: number | string;
  reply_to?: string | null;
  verified?: number | string;
  verified_by?: string | null;
  verified_at?: string | null;
  perspective_type?: string | null;
  perspective_label?: string | null;
  perspective_description?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  applicable_community_id?: string | null;
  applicable_community_name?: string | null;
  reviewed_at?: string | null;
  review_due_at?: string | null;
  review_status?: 'reviewed' | 'unreviewed' | 'stale' | null;
  review_note?: string | null;
  reviewer_first_name?: string | null;
  reviewer_last_name?: string | null;
  updated_by?: string | null;
  user_vote?: string | null;
  first_name?: string;
  last_name?: string;
  avatar_path?: string;
  author_verified?: number | string;
  is_connection?: number | string;
  user_role?: string | null;
  ambassador_logo_path?: string | null;
  updated_by_first_name?: string | null;
  updated_by_last_name?: string | null;
  updated_by_avatar_path?: string | null;
};

export async function fetchThread(threadId: string, userId?: string) {
  const { data } = await apiClient.get<ThreadData>('/fetch_thread.php', {
    params: { thread_id: threadId, user_id: userId },
  });
  return data;
}

export async function fetchPosts(threadId: string, userId?: string) {
  const { data } = await apiClient.get<PostData[]>('/fetch_posts.php', {
    params: { thread_id: threadId, user_id: userId },
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchThreads(forumId: string, userId?: string) {
  const { data } = await apiClient.get<ThreadData[]>('/fetch_threads.php', {
    params: { forum_id: forumId, user_id: userId ?? 0 },
  });
  return Array.isArray(data) ? data : [];
}

export async function voteThread(threadId: string, userId: string, voteType: 'up' | 'down') {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>('/vote_thread.php', {
    thread_id: threadId,
    user_id: userId,
    vote_type: voteType,
  });
  return data;
}

export async function votePost(postId: string, userId: string, voteType: 'up' | 'down') {
  const { data } = await apiClient.post<ApiResponse<Record<string, never>>>('/vote_post.php', {
    post_id: postId,
    user_id: userId,
    vote_type: voteType,
  });
  return data;
}

export async function createReply(
  threadId: string,
  userId: string,
  content: string,
  replyTo?: string | null
) {
  const { data } = await apiClient.post<ApiResponse<{ post_id?: string }>>('/create_reply.php', {
    thread_id: threadId,
    user_id: userId,
    content,
    reply_to: replyTo ?? null,
  });
  return data;
}
