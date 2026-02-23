import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/api/types';

export type ForumItem = {
  forum_id: string;
  community_id?: string;
  name?: string;
  description?: string;
  created_by?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  created_by_avatar_path?: string;
  created_at?: string;
  upvotes?: number | string;
  downvotes?: number | string;
  tags?: string[];
  thread_count?: number | string;
};

export async function fetchForums(communityId: string, userId?: string) {
  const { data } = await apiClient.get<ApiResponse<{ forums?: ForumItem[] }>>('/fetch_forums.php', {
    params: userId ? { community_id: communityId, user_id: userId } : { community_id: communityId },
  });
  if (Array.isArray((data as any))) {
    return data as ForumItem[];
  }
  return data?.forums || [];
}
