import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { type ViewProps } from 'react-native';

type Props = ViewProps & { children: React.ReactNode; className?: string };

export function GradientBg({ style, children, className = '', ...props }: Props) {
  // Luxury cream gradient: #FAF8F3 (Secondary) to #F5F1E8 (Main Background)
  const colors = ['#FAF8F3', '#FAF8F3', '#F5F1E8', '#F5F1E8'] as const;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[{ flex: 1 }, style]}
      {...props}
    >
      {children}
    </LinearGradient>
  );
}
export default GradientBg;
