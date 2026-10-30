import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import './NewsRailPane.css';

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  forumId: string;
  threadId: string;
};

const AUTO_ADVANCE_MS = 8000;
const MAX_SUMMARY_LENGTH = 220;

const cleanText = (value: unknown) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shorten = (value: string, limit = MAX_SUMMARY_LENGTH) => {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit + 1);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > limit * 0.65 ? lastSpace : limit).trim()}…`;
};

const safeExternalUrl = (value: unknown) => {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const normalizeNewsItem = (item: any): NewsItem | null => {
  if (!item || typeof item !== 'object') return null;

  const status = String(item.status ?? item.review_status ?? '').trim().toLowerCase();
  if (status && status !== 'published') return null;
  if (item.is_published !== undefined && Number(item.is_published) !== 1) return null;

  const id = String(item.news_id ?? item.id ?? '').trim();
  const title = cleanText(item.title ?? item.headline);
  if (!id || !title) return null;

  return {
    id,
    title,
    summary: shorten(cleanText(item.summary ?? item.excerpt ?? item.description)),
    sourceName: cleanText(item.source_name ?? item.source ?? 'News source'),
    sourceUrl: safeExternalUrl(item.source_url ?? item.url),
    publishedAt: String(item.published_at ?? item.publication_date ?? item.created_at ?? '').trim(),
    forumId: String(item.forum_id ?? '').trim(),
    threadId: String(item.thread_id ?? '').trim(),
  };
};

export default function NewsRailPane() {
  const { locale } = useLanguage();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadNews = async () => {
      try {
        const response = await fetch('/api/fetch_news.php?limit=6', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`News request failed with ${response.status}`);

        const payload = await response.json();
        const rawItems = Array.isArray(payload?.news)
          ? payload.news
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        const publishedItems = rawItems
          .map(normalizeNewsItem)
          .filter((item: NewsItem | null): item is NewsItem => Boolean(item));
        setItems(publishedItems);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setItems([]);
        }
      }
    };

    loadNews();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    setPrefersReducedMotion(query.matches);
    query.addEventListener?.('change', updatePreference);
    return () => query.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const isPaused = hovered || focusWithin || prefersReducedMotion;
  useEffect(() => {
    if (items.length <= 1 || isPaused) return undefined;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % items.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, items.length]);

  const currentItem = items[currentIndex];
  const formattedDate = useMemo(() => {
    if (!currentItem?.publishedAt) return '';
    const date = new Date(currentItem.publishedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [currentItem?.publishedAt, locale]);

  if (!currentItem) return null;

  const goPrevious = () => {
    setCurrentIndex((index) => (index - 1 + items.length) % items.length);
  };
  const goNext = () => {
    setCurrentIndex((index) => (index + 1) % items.length);
  };
  const discussionUrl = currentItem.forumId && currentItem.threadId
    ? `/info/forum/${encodeURIComponent(currentItem.forumId)}/thread/${encodeURIComponent(currentItem.threadId)}`
    : '';

  return (
    <section
      className="widget-card compact-news-widget"
      aria-labelledby="news-rail-header"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
    >
      <div id="news-rail-header" className="widget-header compact-widget-header">
        <h3 className="widget-title">News</h3>
        <span aria-label={`${items.length} published news ${items.length === 1 ? 'item' : 'items'}`}>
          {items.length}
        </span>
      </div>
      <div className="widget-body">
        <article
          className="news-rail-slide"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} of ${items.length}`}
        >
          <div className="news-rail-meta">
            <span>{currentItem.sourceName}</span>
            {formattedDate && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={currentItem.publishedAt}>{formattedDate}</time>
              </>
            )}
          </div>
          <h4>{currentItem.title}</h4>
          {currentItem.summary && <p>{currentItem.summary}</p>}
          <div className="news-rail-actions">
            {currentItem.sourceUrl && (
              <a href={currentItem.sourceUrl} target="_blank" rel="noopener noreferrer">
                View source <span aria-hidden="true">↗</span>
              </a>
            )}
            {discussionUrl && <Link to={discussionUrl}>Read discussion</Link>}
          </div>
        </article>

        {items.length > 1 && (
          <div className="poll-nav news-rail-nav" aria-label="News carousel controls">
            <button type="button" onClick={goPrevious} aria-label="Previous news item">
              ‹
            </button>
            <div className="poll-dots news-rail-dots" aria-label="Choose a news item">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`news-rail-dot${index === currentIndex ? ' active' : ''}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Show news item ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" onClick={goNext} aria-label="Next news item">
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
