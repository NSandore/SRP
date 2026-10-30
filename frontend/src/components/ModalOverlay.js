import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ModalOverlay.css';

function ModalOverlay({
  isOpen,
  onClose,
  children,
  showCloseButton = true,
  contentClassName = '',
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const body = document.body;
    const currentCount = Number(body.dataset.modalCount || 0);
    body.dataset.modalCount = currentCount + 1;
    body.classList.add('modal-open');
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const nextCount = Number(body.dataset.modalCount || 1) - 1;
      if (nextCount <= 0) {
        body.classList.remove('modal-open');
        delete body.dataset.modalCount;
      } else {
        body.dataset.modalCount = nextCount;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  // Portal into the app shell when it exists so dialogs inherit the active
  // area/community palette (--home-* variables); fall back to body otherwise.
  const portalTarget = document.querySelector('.app-shell') || document.body;

  return createPortal(
    <div className="feature-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div
        className={`feature-overlay-content ${contentClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && onClose && (
          <button
            type="button"
            className="feature-overlay-close"
            aria-label="Close overlay"
            onClick={onClose}
          >
            ×
          </button>
        )}
        <div className="feature-overlay-body">{children}</div>
      </div>
    </div>,
    portalTarget
  );
}

export default ModalOverlay;
