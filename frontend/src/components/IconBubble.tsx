// src/components/IconBubble.tsx
import React from 'react';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

type PresetKey =
  | 'question'
  | 'guide'
  | 'study'
  | 'forum'
  | 'trending'
  | 'webinars'
  | 'poll'
  | 'success';

export type IconBubbleProps = {
  icon: IconType;
  bg?: PresetKey | string; // preset token key or any valid CSS color/var
  size?: number; // px
  iconSize?: number; // px
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
};

const tokenFor = (bg?: IconBubbleProps['bg']): string | undefined => {
  switch (bg) {
    case 'question':
      return 'var(--type-question)';
    case 'guide':
      return 'var(--type-guide)';
    case 'study':
      return 'var(--type-study)';
    case 'forum':
      return 'var(--type-forum)';
    case 'trending':
      return 'var(--accent-trending)';
    case 'webinars':
      return 'var(--accent-webinars)';
    case 'poll':
      return 'var(--accent-poll)';
    case 'success':
      return 'var(--accent-success)';
    default:
      return typeof bg === 'string' ? bg : undefined;
  }
};

export default function IconBubble({
  icon: Icon,
  bg = 'forum',
  size = 24,
  iconSize = 14,
  className = '',
  ariaLabel,
  style = {},
}: IconBubbleProps) {
  const backgroundColor = tokenFor(bg) || 'var(--type-forum)';
  return (
    <span
      className={className}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '9999px',
        backgroundColor,
        flex: '0 0 auto',
        ...style,
      }}
    >
      <Icon size={iconSize} color={'var(--icon-on-color)'} />
    </span>
  );
}

