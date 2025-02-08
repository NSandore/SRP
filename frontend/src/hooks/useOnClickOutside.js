// src/hooks/useOnClickOutside.js
import { useEffect } from 'react';

/**
 * useOnClickOutside(ref, handler)
 * 
 * Calls `handler()` if a click event happens outside of the element
 * pointed to by `ref`.
 */
export default function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      // Do nothing if clicking ref's element or its descendants
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    // or "click", but mousedown is usually better for “outside” detection

    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [ref, handler]);
}
