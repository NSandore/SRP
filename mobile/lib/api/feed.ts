import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/api/types';

export type FeedThread = {
  thread_id?: string;
  thread_title?: string;
  title?: string;
  forum_name?: string;
  community_name?: string;
  preview?: string;
};

export type FeedResponse = ApiResponse<{
  threads?: FeedThread[];
  forums?: any[];
}>;

export async function fetchFeed(userId: string, sort: string = 'latest') {
  const { data } = await apiClient.get<FeedResponse>('/fetch_feed.php', {
    params: { user_id: userId, sort },
  });
  return data;
}

export async function fetchExplore(tags: string[] = []) {
  const { data } = await apiClient.get<ApiResponse<{ forums?: any[]; threads?: FeedThread[] }>>(
    '/fetch_explore.php',
    { params: tags.length ? { tags: tags.join(',') } : {} }
  );
  return data;
}
