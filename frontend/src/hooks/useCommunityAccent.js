import { useEffect } from 'react';
import { getHighestContrastColor, getReadableTextColor } from '../utils/color';

// Keep branding separate from the app-wide theme tokens. The page-level class
// lets the community's own profile, rails, and drawer opt in without changing
// the rest of the application.
export default function useCommunityAccent(primaryColor, secondaryColor) {
  useEffect(() => {
    if (!primaryColor) return undefined;
    const shell = document.querySelector('.app-shell');
    if (!shell) return undefined;
    const colors = [primaryColor, secondaryColor || primaryColor];
    const lightThemeAccent = getHighestContrastColor(colors, '#FFFFFF') || primaryColor;
    const darkThemeAccent = getHighestContrastColor(colors, '#08152B') || primaryColor;
    shell.style.setProperty('--community-accent', primaryColor);
    shell.style.setProperty('--community-accent-secondary', secondaryColor || primaryColor);
    shell.style.setProperty('--community-accent-light-theme', lightThemeAccent);
    shell.style.setProperty('--community-accent-dark-theme', darkThemeAccent);
    shell.style.setProperty('--community-on-accent-light-theme', getReadableTextColor(lightThemeAccent) || '#FFFFFF');
    shell.style.setProperty('--community-on-accent-dark-theme', getReadableTextColor(darkThemeAccent) || '#FFFFFF');
    shell.classList.add('community-accent-active');
    return () => {
      shell.style.removeProperty('--community-accent');
      shell.style.removeProperty('--community-accent-secondary');
      shell.style.removeProperty('--community-accent-light-theme');
      shell.style.removeProperty('--community-accent-dark-theme');
      shell.style.removeProperty('--community-on-accent-light-theme');
      shell.style.removeProperty('--community-on-accent-dark-theme');
      shell.classList.remove('community-accent-active');
    };
  }, [primaryColor, secondaryColor]);
}
