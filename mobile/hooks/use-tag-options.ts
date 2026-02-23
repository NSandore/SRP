import { useEffect, useState } from 'react';

import { fetchTags } from '@/lib/api/tags';
import type { TagOption } from '@/lib/api/tags';

let cachedTags: TagOption[] | null = null;
let pendingRequest: Promise<TagOption[]> | null = null;

const loadTags = () => {
  if (cachedTags) return Promise.resolve(cachedTags);
  if (!pendingRequest) {
    pendingRequest = fetchTags()
      .then((tags) => {
        cachedTags = tags;
        return tags;
      })
      .catch((err) => {
        console.error('Failed to fetch tags:', err);
        cachedTags = [];
        return [];
      })
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
};

export default function useTagOptions() {
  const [tags, setTags] = useState<TagOption[]>(cachedTags || []);
  const [loading, setLoading] = useState(!cachedTags);

  useEffect(() => {
    let mounted = true;
    if (!cachedTags) {
      setLoading(true);
    }
    loadTags().then((list) => {
      if (!mounted) return;
      setTags(list);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { tags, loading };
}
