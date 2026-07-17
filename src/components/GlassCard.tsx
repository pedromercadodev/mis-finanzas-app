import { View, ViewStyle, StyleProp, Platform, LayoutChangeEvent } from 'react-native';
import { ReactNode, useState } from 'react';
import { Canvas, RoundedRect, BlurMask, Group, vec } from '@shopify/react-native-skia';
import { useThemeColors } from '../hooks/useThemeColors';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Color base de la sombra */
  shadowColor?: string;
  /** Nivel de elevación: 'sm' | 'md' | 'lg' | 'xl' */
  elevation?: 'sm' | 'md' | 'lg' | 'xl';
  /** Sin relleno interno */
  noPadding?: boolean;
  /** Padding personalizado */
  padding?: number;
}

const ELEVATION_MAP = {
  sm: { blurRadius: 8, offsetY: 2, opacity: 0.25 },
  md: { blurRadius: 16, offsetY: 4, opacity: 0.3 },
  lg: { blurRadius: 24, offsetY: 8, opacity: 0.35 },
  xl: { blurRadius: 32, offsetY: 10, opacity: 0.4 },
};

/**
 * GlassCard - Tarjeta con efecto glassmorphism y sombra DIFUMINADA REAL.
 *
 * En iOS: usa shadowRadius nativo (blur real nativo de Core Animation).
 * En Android: usa @shopify/react-native-skia con BlurMask para renderizar
 * una sombra con desenfoque gaussiano REAL (no la sombra sólida de elevation).
 *
 * El glass effect se logra con backgroundColor semitransparente + border sutil.
 */
export default function GlassCard({
  children,
  style,
  shadowColor: customShadowColor,
  elevation = 'md',
  noPadding = false,
  padding,
}: GlassCardProps) {
  const themeColors = useThemeColors();
  const shadowColor = customShadowColor || '#0A1E3D';
  const elev = ELEVATION_MAP[elevation];
  const [cardWidth, setCardWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== cardWidth || height !== cardHeight) {
      setCardWidth(width);
      setCardHeight(height);
    }
  };

  const glassStyle: ViewStyle = {
    backgroundColor: themeColors.surfaceContainer + '99',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.outlineVariant + '30',
  };

  // iOS: shadowRadius produce blur REAL (como box-shadow blur-radius en CSS)
  if (Platform.OS === 'ios') {
    return (
      <View
        style={[
          {
            ...glassStyle,
            shadowColor,
            shadowOffset: { width: 0, height: elev.offsetY },
            shadowOpacity: 0.5,
            shadowRadius: elev.blurRadius,
          },
          !noPadding && { padding: padding ?? 20 },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Android: usamos Skia para renderizar sombra con blur REAL
  return (
    <View
      style={[{ position: 'relative' }, style]}
      onLayout={onLayout}
    >
      {/* Sombra con blur real renderizada por Skia */}
      {cardWidth > 0 && cardHeight > 0 && (
        <Canvas
          style={{
            position: 'absolute',
            top: -elev.blurRadius,
            left: -elev.blurRadius,
            width: cardWidth + elev.blurRadius * 2,
            height: cardHeight + elev.blurRadius * 2,
            zIndex: 0,
          }}
          pointerEvents="none"
        >
          <Group
            transform={[
              { translateX: elev.blurRadius },
              { translateY: elev.blurRadius + elev.offsetY },
            ]}
          >
            <RoundedRect
              x={0}
              y={0}
              width={cardWidth}
              height={cardHeight}
              r={16}
              color={shadowColor}
              opacity={elev.opacity}
            >
              <BlurMask blur={elev.blurRadius} style="normal" />
            </RoundedRect>
          </Group>
        </Canvas>
      )}
      {/* Contenido de la tarjeta */}
      <View
        style={[
          glassStyle,
          { zIndex: 1 },
          !noPadding && { padding: padding ?? 20 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
