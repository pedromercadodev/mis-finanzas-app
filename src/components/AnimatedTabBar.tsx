import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { shadows } from '../theme/shadows';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { haptic } from '../utils/haptics';

const TABS = [
  { name: 'index', title: 'Resumen', icon: 'home-outline', iconActive: 'home' },
  { name: 'transactions', title: 'Movimientos', icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
  { name: 'ai-chat', title: 'Asistente', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'reports', title: 'Reportes', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { name: 'settings', title: 'Ajustes', icon: 'settings-outline', iconActive: 'settings' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / TABS.length;

// Custom easing curves — Emil Kowalski style
const EASE_OUT_STRONG = { damping: 18, stiffness: 220, mass: 0.7 };
const EASE_OUT_SPRING = { damping: 14, stiffness: 250, mass: 0.6 };

export default function AnimatedTabBar() {
  const themeColors = useThemeColors();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const activeIndex = TABS.findIndex((t) => {
    const tabPath = t.name === 'index' ? '/(tabs)' : `/(tabs)/${t.name}`;
    return pathname === tabPath || pathname === `/${t.name}`;
  });
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;

  // Shared values para animaciones
  const slideOffset = useSharedValue(currentIndex * TAB_WIDTH);
  const prevIndex = useSharedValue(currentIndex);

  // Valores por tab: progreso de morphing (0=outline, 1=filled)
  const morphProgress = TABS.map(() => useSharedValue(0));
  // Escala del icono
  const iconScale = TABS.map(() => useSharedValue(1));
  // Rotación (solo para sparkles)
  const iconRotation = TABS.map(() => useSharedValue(0));

  useEffect(() => {
    if (prevIndex.value === currentIndex) return;

    if (reducedMotion) {
      slideOffset.value = currentIndex * TAB_WIDTH;
      const oldIdx = Math.round(prevIndex.value);
      if (oldIdx >= 0 && oldIdx < TABS.length) {
        morphProgress[oldIdx].value = 0;
        iconScale[oldIdx].value = 1;
        iconRotation[oldIdx].value = 0;
      }
      morphProgress[currentIndex].value = 1;
      iconScale[currentIndex].value = 1;
      prevIndex.value = currentIndex;
      return;
    }

    // Animación del indicador deslizante — spring con damping crítico
    slideOffset.value = withSpring(currentIndex * TAB_WIDTH, EASE_OUT_STRONG);

    // Resetear tab anterior
    const oldIdx = Math.round(prevIndex.value);
    if (oldIdx >= 0 && oldIdx < TABS.length) {
      morphProgress[oldIdx].value = withSpring(0, EASE_OUT_STRONG);
      iconScale[oldIdx].value = withSpring(1, EASE_OUT_STRONG);
      if (TABS[oldIdx].name === 'ai-chat') {
        iconRotation[oldIdx].value = withTiming(0, { duration: 200 });
      }
    }

    // Activar nuevo tab
    morphProgress[currentIndex].value = withSpring(1, EASE_OUT_STRONG);
    iconScale[currentIndex].value = withSpring(1.1, EASE_OUT_SPRING);

    // Rotación especial para sparkles (Asistente)
    if (TABS[currentIndex].name === 'ai-chat') {
      iconRotation[currentIndex].value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 })
      );
    }

    haptic('light');
    prevIndex.value = currentIndex;
  }, [currentIndex, reducedMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideOffset.value }],
  }));

  const navigate = useCallback((name: string) => {
    if (name === 'ai-chat') {
      router.push('/ai-chat');
      return;
    }
    const targetPath = name === 'index' ? '/(tabs)' as const : `/(tabs)/${name}` as const;
    router.replace(targetPath);
  }, [router]);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: Platform.OS === 'ios'
          ? themeColors.surface + 'E8'
          : themeColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: insets.bottom + 8,
        paddingTop: 8,
        height: 70 + insets.bottom,
        position: 'relative',
        overflow: 'hidden',
        // Sin border — solo sombra para profundidad
        ...shadows.xl,
      }}
    >
      {/* Indicador deslizante redondeado */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: TAB_WIDTH * 0.2,
            width: TAB_WIDTH * 0.6,
            height: 3,
            backgroundColor: themeColors.primary,
            borderRadius: 2,
          },
          indicatorStyle,
        ]}
      />

      {TABS.map((tab, index) => {
        const isActive = index === currentIndex;

        const iconContainerStyle = useAnimatedStyle(() => {
          const scale = iconScale[index].value;
          return {
            transform: [{ scale }],
          };
        });

        const outlineIconStyle = useAnimatedStyle(() => ({
          opacity: 1 - morphProgress[index].value,
          transform: [
            { scale: interpolate(morphProgress[index].value, [0, 1], [1, 0.8]) },
          ],
        }));

        const filledIconStyle = useAnimatedStyle(() => ({
          opacity: morphProgress[index].value,
          position: 'absolute',
          transform: [
            { scale: interpolate(morphProgress[index].value, [0, 1], [0.8, 1]) },
            tab.name === 'ai-chat'
              ? { rotate: `${iconRotation[index].value}deg` }
              : { rotate: '0deg' },
          ],
        }));

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigate(tab.name)}
            activeOpacity={0.7}
            accessibilityLabel={tab.title}
            accessibilityRole="tab"
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 6,
            }}
          >
            <Animated.View
              style={[
                {
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: isActive ? themeColors.primary + '14' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 3,
                },
                iconContainerStyle,
              ]}
            >
              <Animated.View style={outlineIconStyle}>
                <Ionicons
                  name={tab.icon as any}
                  size={24}
                  color={isActive ? themeColors.primary : themeColors.textTertiary}
                />
              </Animated.View>

              <Animated.View style={filledIconStyle}>
                <Ionicons
                  name={tab.iconActive as any}
                  size={24}
                  color={themeColors.primary}
                />
              </Animated.View>
            </Animated.View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? themeColors.primary : themeColors.textTertiary,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
