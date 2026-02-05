export const normalizeTagValue = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const mapTagNamesToSlugs = (names = [], options = []) => {
  if (!Array.isArray(names) || !Array.isArray(options)) return [];
  const optionMap = new Map(options.map((opt) => [opt.name, opt.slug]));
  return names
    .map((name) => optionMap.get(name) || normalizeTagValue(name))
    .filter(Boolean);
};

export const mapTagSlugsToNames = (slugs = [], options = []) => {
  if (!Array.isArray(slugs) || !Array.isArray(options)) return [];
  const optionMap = new Map(options.map((opt) => [opt.slug, opt.name]));
  return slugs
    .map((slug) => optionMap.get(slug) || slug)
    .filter(Boolean);
};
