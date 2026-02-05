import { useEffect, useState } from 'react';
import axios from 'axios';

let cachedTags = null;
let pendingRequest = null;

const fetchTags = () => {
  if (cachedTags) return Promise.resolve(cachedTags);
  if (!pendingRequest) {
    pendingRequest = axios
      .get('/api/fetch_tags.php')
      .then((res) => {
        const tags = res.data?.tags || [];
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
  const [tags, setTags] = useState(cachedTags || []);
  const [loading, setLoading] = useState(!cachedTags);

  useEffect(() => {
    let mounted = true;
    if (!cachedTags) {
      setLoading(true);
    }
    fetchTags().then((list) => {
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
