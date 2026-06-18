import React from 'react';
import { View, type ViewProps } from 'react-native';

export type GlassVariant = 'card' | 'cardStrong' | 'sheet' | 'pill' | 'bar';

export type GlassCardProps = ViewProps & {
  variant?: GlassVariant;
  glow?: boolean;
  className?: string;
};

export function GlassCard({
  style,
  variant = 'card',
  glow = false,
  className = '',
  ...props
}: GlassCardProps) {
  // Styles for different variants using Tailwind
  const variantMap = {
    card: 'rounded-[32px] bg-brand-surface/80 border border-brand-glass shadow-sm p-5',
    cardStrong: 'rounded-[36px] bg-brand-surface border border-brand-glass shadow-md p-6',
    sheet: 'rounded-t-[32px] bg-brand-cream border-t border-brand-glass shadow-lg p-6',
    pill: 'rounded-full bg-brand-glass border border-brand-glass px-4 py-2 shadow-sm',
    bar: 'bg-brand-glass border-b border-brand-glass py-3 px-4 shadow-sm',
  };

  const glowClass = glow ? 'shadow-[0_8px_30px_rgb(255,255,255,0.3)]' : '';
  const combinedClasses = `${variantMap[variant]} ${glowClass} ${className}`;

  return (
    <View
      className={combinedClasses}
      style={style}
      {...props}
    />
  );
}
export default GlassCard;
