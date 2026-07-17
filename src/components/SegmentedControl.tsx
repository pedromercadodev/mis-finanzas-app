import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shadows } from '../theme/shadows';

interface SegmentedControlOption<T extends string> {
  key: T;
  label: string;
  icon?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
}

/**
 * Spring con critical damping — respuesta rápida sin overshoot.
 * El indicador "sigue" al dedo sin pasarse.
 */
const SPRING_CRITICAL = { damping: 24, stiffness: 300, mass: 0.5 };

/**
 * SegmentedControl — control de segmentos con indicador deslizante.
 * Sin bordes sólidos, usa sombra interior para el indicador.
 *
 * Principios aplicados:
 * - Emil §3: sin borderWidth, sombra interior (shadows.inner) para el indicador
 * - Emil §4: spring con critical damping (sin overshoot)
 * - Apple §5: respuesta inmediata, masa ligera
 * - Apple §16: reduced motion respetado
 */
export default function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
}: SegmentedControlProps<T>) {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const itemRefs = useRef<{ [key: string]: number }>({});

  const selectedIndex = options.findIndex((o) => o.key === selected);
  const indicatorOffset = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setContainerWidth(width);
    const segWidth = width / options.length;
    indicatorOffset.value = selectedIndex * segWidth;
    indicatorWidth.value = segWidth;
  };

  const handlePress = (key: T, index: number) => {
    onSelect(key);
    const segWidth = containerWidth / options.length;
    if (reducedMotion) {
      indicatorOffset.value = index * segWidth;
    } else {
      indicatorOffset.value = withSpring(index * segWidth, SPRING_CRITICAL);
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View
      onLayout={handleLayout}
      style={{
        flexDirection: 'row',
        backgroundColor: themeColors.surface,
        borderRadius: 12,
        padding: 3,
        position: 'relative',
        // Sin borderWidth — la profundidad viene de la sombra interior del indicador
      }}
    >
      {/* Indicador deslizante con sombra interior */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            bottom: 3,
            borderRadius: 10,
            backgroundColor: themeColors.secondary,
            ...shadows.inner,
          },
          indicatorStyle,
        ]}
      />

      {options.map((option, index) => {
        const isSelected = option.key === selected;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => handlePress(option.key, index)}
            activeOpacity={0.7}
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 8,
              gap: 4,
              zIndex: 1,
              minHeight: 44,
            }}
          >
            {option.icon && (
              <Text style={{ fontSize: 14 }}>{option.icon}</Text>
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: isSelected ? '700' : '500',
                color: isSelected ? themeColors.background : themeColors.textSecondary,
              }}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
