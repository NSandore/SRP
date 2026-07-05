import { apiClient } from '@/lib/api/client';

export type CommunityItem = {
  community_id: string;
  community_type?: string;
  name?: string;
  location?: string;
  tagline?: string;
  logo_path?: string | null;
  followers_count?: number | string;
  following_count?: number | string;
  admin_count?: number | string;
  is_followed?: number | string;
};

export type CommunityQuery = {
  type: 'university' | 'group';
  page?: number;
  search?: string;
  scope?: 'all' | 'followed' | 'unfollowed';
  sort?: 'popularity' | 'alpha';
  userId?: string;
};

export type CommunityResponse = {
  communities: CommunityItem[];
  totalPages: number;
  currentPage: number;
};

export async function fetchCommunities({
  type,
  page = 1,
  search = '',
  scope = 'all',
  sort = 'popularity',
  userId,
}: CommunityQuery): Promise<CommunityResponse> {
  const endpoint =
    type === 'group' ? '/fetch_all_group_data.php' : '/fetch_all_university_data.php';
  const params: Record<string, string | number> = {
    page,
    search,
    scope,
    sort,
  };
  if (userId) {
    params.user_id = userId;
  }
  const { data } = await apiClient.get(endpoint, { params });
  return {
    communities: (data as any)?.communities || [],
    totalPages: Number((data as any)?.total_pages || 1),
    currentPage: Number((data as any)?.current_page || page),
  };
}
