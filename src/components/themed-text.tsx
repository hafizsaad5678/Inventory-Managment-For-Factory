import React from 'react';
import { Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: 'text' | 'textSecondary' | 'textMuted' | 'textInverse' | 'success' | 'danger' | 'warning' | 'accent' | 'accent-sec';
  className?: string;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor = 'text',
  className = '',
  ...rest
}: ThemedTextProps) {
  // Map our semantic themes to Tailwind colors
  const colorMap = {
    text: 'text-brand-primary',
    textSecondary: 'text-brand-secondary',
    textMuted: 'text-brand-muted',
    textInverse: 'text-white',
    success: 'text-brand-success',
    danger: 'text-brand-danger',
    warning: 'text-brand-warning',
    accent: 'text-brand-accent',
    'accent-sec': 'text-brand-accent-sec',
  };

  // Map types to text styling classes
  const typeMap = {
    default: 'font-inter text-[15px] font-medium leading-relaxed',
    small: 'font-inter text-[13px] font-normal leading-relaxed',
    smallBold: 'font-inter text-[13px] font-bold leading-relaxed',
    title: 'font-inter text-3xl font-extrabold tracking-tight',
    subtitle: 'font-inter text-xl font-bold tracking-tight',
    link: 'font-inter text-[14px] font-semibold underline',
    linkPrimary: 'font-inter text-[14px] font-bold text-brand-accent',
    code: 'font-mono text-xs font-bold bg-transparent tracking-wide',
  };

  const combinedClasses = `${colorMap[themeColor]} ${typeMap[type]} ${className}`;

  return (
    <Text
      className={combinedClasses}
      style={style}
      {...rest}
    />
  );
}
export default ThemedText;
