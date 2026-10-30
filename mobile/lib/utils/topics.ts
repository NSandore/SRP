export const ALL_TOPICS_VALUE = '__all__';

export const normalizeTopicValue = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

export const topicLabelFromValue = (value: string) =>
  String(value || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const extractForumTopicsFromForum = (forum: any): string[] => {
  const candidates = [forum?.topics, forum?.topic, forum?.category, forum?.categories, forum?.tags];
  const flat = candidates
    .flatMap((entry) => {
      if (!entry) return [];
      if (Array.isArray(entry)) return entry;
      if (typeof entry === 'string') return entry.split(',');
      return [];
    })
    .map((value) => normalizeTopicValue(value))
    .filter(Boolean);
  return Array.from(new Set(flat));
};
