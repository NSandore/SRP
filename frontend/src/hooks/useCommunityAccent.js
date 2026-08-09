import { useEffect } from 'react';

// While a community profile is open, tint the app shell's accent variables
// (login/nav buttons, pills, links) with the community's own colors. The
// variables cascade from .app-shell, so removing them on unmount restores the
// area/theme palette.
export default function useCommunityAccent(primaryColor, secondaryColor) {
  useEffect(() => {
    if (!primaryColor) return undefined;
    const shell = document.querySelector('.app-shell');
    if (!shell) return undefined;
    shell.style.setProperty('--home-forest', primaryColor);
    shell.style.setProperty('--home-forest-light', secondaryColor || primaryColor);
    return () => {
      shell.style.removeProperty('--home-forest');
      shell.style.removeProperty('--home-forest-light');
    };
  }, [primaryColor, secondaryColor]);
}
