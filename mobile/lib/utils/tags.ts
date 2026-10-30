type TagStyle = {
  color: string;
  borderColor: string;
  backgroundColor: string;
};

const normalizeTag = (tag: string) => String(tag || '').toLowerCase();

const palette: Record<string, { color: string }> = {
  financial: { color: '#0f766e' },
  admissions: { color: '#92400e' },
  housing: { color: '#9a3412' },
  academics: { color: '#1d4ed8' },
  career: { color: '#166534' },
  events: { color: '#9f1239' },
  international: { color: '#3730a3' },
  wellness: { color: '#854d0e' },
  tech: { color: '#334155' },
};

const keywordGroups = [
  { key: 'financial', words: ['financial', 'aid', 'scholar', 'grant', 'loan', 'fafsa', 'tuition'] },
  { key: 'admissions', words: ['admission', 'apply', 'application', 'waitlist', 'deferr', 'accept', 'transfer'] },
  { key: 'housing', words: ['housing', 'dorm', 'roommate', 'residence', 'meal plan', 'meal'] },
  { key: 'academics', words: ['academ', 'major', 'course', 'class', 'grade', 'gpa', 'research'] },
  { key: 'career', words: ['career', 'job', 'intern', 'resume', 'network', 'employment'] },
  { key: 'events', words: ['event', 'club', 'activity', 'sports', 'game', 'social'] },
  { key: 'international', words: ['international', 'visa', 'immigration', 'study abroad'] },
  { key: 'wellness', words: ['health', 'wellness', 'mental', 'counsel', 'therapy'] },
  { key: 'tech', words: ['engineering', 'computer', 'cs', 'software', 'tech'] },
];

const paletteKeys = Object.keys(palette);

const hashTag = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const tint = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getTagStyle = (tag: string): TagStyle => {
  const normalized = normalizeTag(tag);
  if (!normalized) {
    return { color: '#64748b', borderColor: '#cbd5f5', backgroundColor: 'rgba(148, 163, 184, 0.2)' };
  }
  const matched = keywordGroups.find(({ words }) => words.some((word) => normalized.includes(word)));
  const entry = matched && palette[matched.key] ? palette[matched.key] : palette[paletteKeys[hashTag(normalized) % paletteKeys.length]];
  return {
    color: entry.color,
    borderColor: entry.color,
    backgroundColor: tint(entry.color, 0.14),
  };
};
