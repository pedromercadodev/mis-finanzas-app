import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '../hooks/useThemeColors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  flex?: number;
  style?: any;
}

export default function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  flex,
  style,
}: SkeletonProps) {
  const themeColors = useThemeColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          flex,
          backgroundColor: themeColors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// --- Skeleton presets for specific screens ---

export function DashboardSkeleton() {
  const themeColors = useThemeColors();
  return (
    <View style={{ padding: 20, gap: 20 }}>
      {/* Balance card skeleton */}
      <View
        style={{
          backgroundColor: themeColors.surface,
          borderRadius: 20,
          padding: 20,
          gap: 12,
        }}>
        <Skeleton width={100} height={14} />
        <Skeleton width={180} height={32} borderRadius={6} />
        <Skeleton width={140} height={14} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={60} height={12} />
            <Skeleton width={80} height={18} borderRadius={4} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={60} height={12} />
            <Skeleton width={80} height={18} borderRadius={4} />
          </View>
        </View>
      </View>

      {/* Exchange rate skeleton */}
      <View
        style={{
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 16,
          gap: 12,
        }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={50} height={12} />
            <Skeleton width={90} height={20} borderRadius={4} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={50} height={12} />
            <Skeleton width={90} height={20} borderRadius={4} />
          </View>
        </View>
      </View>

      {/* Accounts skeleton */}
      <View style={{ gap: 8 }}>
        <Skeleton width={120} height={18} borderRadius={4} />
        <ScrollViewSkeleton />
      </View>

      {/* Recent transactions skeleton */}
      <View style={{ gap: 8 }}>
        <Skeleton width={150} height={18} borderRadius={4} />
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: themeColors.surface,
              borderRadius: 14,
              padding: 16,
            }}>
            <Skeleton width={44} height={44} borderRadius={14} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={15} borderRadius={4} />
              <Skeleton width="40%" height={12} borderRadius={4} />
            </View>
            <Skeleton width={70} height={18} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function ReportsSkeleton() {
  const themeColors = useThemeColors();
  return (
    <View style={{ padding: 20, gap: 20 }}>
      {/* Period selector skeleton */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} flex={1} height={40} borderRadius={12} />
        ))}
      </View>

      {/* Summary cards skeleton */}
      <View
        style={{
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 16,
          gap: 12,
        }}>
        <Skeleton width={140} height={16} borderRadius={4} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, gap: 6, alignItems: 'center' }}>
              <Skeleton width={50} height={12} />
              <Skeleton width={70} height={18} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>

      {/* Tabs skeleton */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} flex={1} height={40} borderRadius={12} />
        ))}
      </View>

      {/* Chart skeleton */}
      <View
        style={{
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 16,
          gap: 16,
        }}>
        <Skeleton width={180} height={16} borderRadius={4} />
        <Skeleton width="100%" height={200} borderRadius={12} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Skeleton width={12} height={3} borderRadius={2} />
              <Skeleton width={50} height={12} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ScrollViewSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          width={140}
          height={100}
          borderRadius={16}
        />
      ))}
    </View>
  );
}
