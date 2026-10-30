export const FORUM_TITLE_MAX_LENGTH = 100;
export const THREAD_TITLE_MAX_LENGTH = 160;
export const POST_MAX_LENGTH = 10000;

export const getPlainTextLength = (value = '') => {
  const input = String(value ?? '');
  if (!input) return 0;

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = input;
    return (container.textContent || '').trim().length;
  }

  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim()
    .length;
};
