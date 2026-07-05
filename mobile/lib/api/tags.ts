import { apiClient } from '@/lib/api/client';

export type TagOption = {
  name: string;
  slug: string;
};

export async function fetchTags() {
  const { data } = await apiClient.get<{ tags?: TagOption[] }>('/fetch_tags.php');
  return data?.tags || [];
}
