import React from 'react';
import { View, type ViewProps } from 'react-native';
import { GlassCard, GlassVariant } from './glass-card';

export type ThemedViewProps = ViewProps & {
  type?: 'background' | 'backgroundElement' | 'backgroundSelected' | 'backgroundCard' | 'accent' | 'accentDark';
  glass?: GlassVariant;
  className?: string;
};

export function ThemedView({
  style,
  type = 'background',
  glass,
  className = '',
  ...otherProps
}: ThemedViewProps) {
  if (glass) {
    return <GlassCard variant={glass} style={style} className={className} {...otherProps} />;
  }

  const bgMap = {
    background: 'bg-brand-surface',
    backgroundElement: 'bg-brand-cream',
    backgroundSelected: 'bg-brand-glass border border-brand-glass',
    backgroundCard: 'bg-brand-cream shadow-sm',
    accent: 'bg-brand-accent',
    accentDark: 'bg-brand-accent-sec',
  };

  const combinedClasses = `${bgMap[type]} ${className}`;

  return (
    <View
      className={combinedClasses}
      style={style}
      {...otherProps}
    />
  );
}
export default ThemedView;
