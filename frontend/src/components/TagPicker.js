import React from 'react';

export default function TagPicker({
  label = 'Tags',
  options = [],
  value = [],
  onChange,
  max = 5,
  helperText = '',
  disabled = false,
}) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const handleToggle = (slug) => {
    if (!onChange || disabled) return;
    const next = new Set(selected);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      if (max && next.size >= max) return;
      next.add(slug);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="tag-picker">
      <div className="tag-picker__header">
        <span className="tag-picker__label">{label}</span>
        {max ? <span className="tag-picker__limit">Up to {max}</span> : null}
      </div>
      {helperText ? <p className="tag-picker__helper">{helperText}</p> : null}
      <div className="chips-row tag-picker__chips">
        {options.length === 0 ? (
          <span className="muted">No tags available.</span>
        ) : (
          options.map((tag) => {
            const slug = tag.slug || tag.name;
            const active = selected.has(slug);
            return (
              <button
                type="button"
                key={slug}
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => handleToggle(slug)}
                disabled={disabled}
                aria-pressed={active}
              >
                {tag.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
