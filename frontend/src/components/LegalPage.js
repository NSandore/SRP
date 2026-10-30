import React, { useEffect, useState } from 'react';
import './LegalPage.css';

/**
 * Shared shell for the Privacy Policy and Terms of Service.
 *
 * The policy text lives in `public/legal/*.md` so it can be edited without a
 * rebuild. It is a legal document that has to come from the operator, so a
 * production build refuses to show it while any `[PLACEHOLDER]` is still in the
 * text and shows the "not published yet" notice instead.
 */

// Bracketed ALL-CAPS tokens such as [DATE OF PUBLICATION] or [NUMBER OF DAYS].
const PLACEHOLDER_PATTERN = /\[[A-Z0-9][A-Z0-9 ,."'/()&-]*\]/;

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function renderInline(text) {
  return text.split(INLINE_PATTERN).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{renderInline(part.slice(2, -2))}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && SAFE_HREF.test(link[2])) {
      const external = /^https?:\/\//i.test(link[2]);
      return (
        <a
          key={idx}
          href={link[2]}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

// Minimal markdown: ## headings, bullet and numbered lists, paragraphs, and
// two trailing spaces for a line break. The leading # title is skipped because
// the page header already shows it.
function parseMarkdown(source) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  source.split('\n').forEach((raw) => {
    const line = raw.replace(/\s+$/, '');
    const hardBreak = /\s{2,}$/.test(raw) && line.length > 0;
    const bullet = line.match(/^- (.*)$/);
    const numbered = line.match(/^\d+\. (.*)$/);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
    } else {
      flushList();
      paragraph.push({ text: line, hardBreak });
    }
  });
  flushParagraph();
  flushList();
  return blocks;
}

function renderBlock(block, idx) {
  switch (block.type) {
    case 'h2':
      return <h2 key={idx}>{renderInline(block.text)}</h2>;
    case 'ul':
      return (
        <ul key={idx}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={idx}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    default:
      return (
        <p key={idx}>
          {block.lines.map((entry, i) => (
            <React.Fragment key={i}>
              {renderInline(entry.text)}
              {entry.hardBreak && <br />}
              {!entry.hardBreak && i < block.lines.length - 1 && ' '}
            </React.Fragment>
          ))}
        </p>
      );
  }
}

function LegalPage({ title, kicker, src }) {
  const [state, setState] = useState({ status: 'loading', text: '' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', text: '' });
    fetch(`${process.env.PUBLIC_URL || ''}${src}`, { cache: 'no-cache' })
      .then((resp) => (resp.ok ? resp.text() : Promise.reject(new Error(`HTTP ${resp.status}`))))
      .then((text) => {
        // The SPA fallback answers missing files with index.html.
        if (/^\s*</.test(text)) throw new Error('Document not found');
        if (!cancelled) setState({ status: 'ready', text });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', text: '' });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const hasPlaceholders = PLACEHOLDER_PATTERN.test(state.text);
  const blockedInProduction = hasPlaceholders && process.env.NODE_ENV === 'production';
  const showText = state.status === 'ready' && !blockedInProduction;

  return (
    <div className="legal-page">
      <header className="legal-page__header">
        {kicker && <p className="legal-page__kicker">{kicker}</p>}
        <h1 className="legal-page__title">{title}</h1>
      </header>

      {state.status === 'loading' && <p className="legal-page__meta">Loading…</p>}

      {state.status === 'error' && (
        <div className="legal-page__pending">
          <p>This document could not be loaded. Please try again shortly.</p>
        </div>
      )}

      {state.status === 'ready' && blockedInProduction && (
        <div className="legal-page__pending">
          <p>This document has not been published yet.</p>
        </div>
      )}

      {showText && (
        <>
          {hasPlaceholders && (
            <div className="legal-page__pending">
              <p>Draft: unfilled [PLACEHOLDER] values remain. This is hidden in production.</p>
            </div>
          )}
          <div className="legal-page__body">{parseMarkdown(state.text).map(renderBlock)}</div>
        </>
      )}
    </div>
  );
}

export function PrivacyPolicyPage() {
  return <LegalPage kicker="Legal" title="Privacy Policy" src="/legal/privacy.md" />;
}

export function TermsPage() {
  return <LegalPage kicker="Legal" title="Terms of Service" src="/legal/terms.md" />;
}
