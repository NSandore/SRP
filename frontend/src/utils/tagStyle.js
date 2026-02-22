const normalizeTag = (tag) => String(tag || '').toLowerCase();

const palette = {
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

const hashTag = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getTagStyle = (tag) => {
  const normalized = normalizeTag(tag);
  if (!normalized) return {};
  const matched = keywordGroups.find(({ words }) => words.some((word) => normalized.includes(word)));
  const entry = matched && palette[matched.key]
    ? palette[matched.key]
    : palette[paletteKeys[hashTag(normalized) % paletteKeys.length]];
  return {
    '--tag-color': entry.color,
    color: 'var(--tag-color)',
    borderColor: 'var(--tag-color)',
    background: 'color-mix(in srgb, var(--tag-color) 14%, transparent)',
  };
};

export default getTagStyle;
