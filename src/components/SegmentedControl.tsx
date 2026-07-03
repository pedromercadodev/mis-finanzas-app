import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useThemeColors } from '../hooks/useThemeColors';

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

const SPRING_CONFIG = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * Control de segmentos animado con indicador deslizante.
 * Reemplaza los botones de filtro de período con un sliding indicator estilo iOS.
 */
export default function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
}: SegmentedControlProps<T>) {
  const themeColors = useThemeColors();
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
    indicatorOffset.value = withSpring(index * segWidth, SPRING_CONFIG);
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
        borderWidth: 1,
        borderColor: themeColors.border,
      }}
    >
      {/* Indicador deslizante */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            bottom: 3,
            borderRadius: 10,
            backgroundColor: themeColors.primary,
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
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
              paddingHorizontal: 8,
              gap: 4,
              zIndex: 1,
            }}
          >
            {option.icon && (
              <Text style={{ fontSize: 14 }}>{option.icon}</Text>
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: isSelected ? '700' : '500',
                color: isSelected ? '#FFF' : themeColors.textSecondary,
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
