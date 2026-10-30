import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import './PageNavigator.css';

const normalizeTotalPages = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const clampPage = (value, totalPages, fallback = 1) => {
  const total = normalizeTotalPages(totalPages);
  const parsed = Number.parseInt(String(value), 10);
  const fallbackPage = Math.min(total, Math.max(1, Number.parseInt(String(fallback), 10) || 1));
  return Number.isFinite(parsed) ? Math.min(total, Math.max(1, parsed)) : fallbackPage;
};

function PageNavigator({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className = '',
  ariaLabel = 'Pages',
}) {
  const total = normalizeTotalPages(totalPages);
  const current = clampPage(page, total);
  const [draftPage, setDraftPage] = useState(String(current));

  useEffect(() => {
    setDraftPage(String(current));
  }, [current, total]);

  if (total <= 1) return null;

  const goToPage = (requestedPage) => {
    const nextPage = clampPage(requestedPage, total, current);
    setDraftPage(String(nextPage));
    if (!disabled && nextPage !== current) {
      onPageChange(nextPage);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    goToPage(draftPage);
  };

  const rootClassName = ['page-navigator', className].filter(Boolean).join(' ');

  return (
    <nav className={rootClassName} aria-label={ariaLabel}>
      <div className="page-navigator__edge page-navigator__edge--back">
        <button
          type="button"
          className="page-navigator__button"
          aria-label="First page"
          title="First page"
          disabled={disabled || current <= 1}
          onClick={() => goToPage(1)}
        >
          <ChevronsLeft size={15} aria-hidden="true" />
          <span>First</span>
        </button>
        <button
          type="button"
          className="page-navigator__button"
          aria-label="Previous page"
          title="Previous page"
          disabled={disabled || current <= 1}
          onClick={() => goToPage(current - 1)}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          <span>Previous</span>
        </button>
      </div>

      <form className="page-navigator__jump" onSubmit={handleSubmit} aria-label="Go to page">
        <label className="page-navigator__page-label">
          <span>Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Page number"
            value={draftPage}
            disabled={disabled}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraftPage(event.target.value.replace(/\D/g, ''))}
            onBlur={() => {
              if (draftPage === '') setDraftPage(String(current));
            }}
          />
        </label>
        <span className="page-navigator__total">of {total.toLocaleString()}</span>
        <button
          type="submit"
          className="page-navigator__go"
          disabled={disabled || draftPage === ''}
        >
          Go
        </button>
      </form>

      <div className="page-navigator__edge page-navigator__edge--forward">
        <button
          type="button"
          className="page-navigator__button"
          aria-label="Next page"
          title="Next page"
          disabled={disabled || current >= total}
          onClick={() => goToPage(current + 1)}
        >
          <span>Next</span>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="page-navigator__button"
          aria-label="Last page"
          title="Last page"
          disabled={disabled || current >= total}
          onClick={() => goToPage(total)}
        >
          <span>Last</span>
          <ChevronsRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default PageNavigator;
