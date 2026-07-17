import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { typography, TypographyKey } from '../theme/typography';
import { useThemeColors } from '../hooks/useThemeColors';

interface ThemedTextProps extends TextProps {
  type?: TypographyKey;
  color?: string;
  themeColor?: 'text' | 'textSecondary' | 'textTertiary' | 'primary' | 'success' | 'danger' | 'warning' | 'usd' | 'bs' | 'secondary' | 'tertiary' | 'onSurfaceVariant' | 'onSecondaryContainer' | 'onPrimaryContainer';
  opacity?: number;
}

export default function ThemedText({
  type = 'body',
  color,
  themeColor,
  opacity,
  style,
  children,
  ...props
}: ThemedTextProps) {
  const themeColors = useThemeColors();

  const resolvedColor = color || (themeColor ? themeColors[themeColor] : themeColors.text);

  return (
    <Text
      style={[
        typography[type] as TextStyle,
        { color: resolvedColor },
        opacity !== undefined ? { opacity } : undefined,
        style as TextStyle,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
