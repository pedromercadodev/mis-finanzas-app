import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
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

const SPRING_CONFIG = { damping: 15, stiffness: 200, mass: 0.8 };
const SCALE_SPRING = { damping: 12, stiffness: 250, mass: 0.6 };

export default function AnimatedTabBar() {
  const themeColors = useThemeColors();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

    // Animación del indicador deslizante
    slideOffset.value = withSpring(currentIndex * TAB_WIDTH, SPRING_CONFIG);

    // Resetear tab anterior
    const oldIdx = Math.round(prevIndex.value);
    if (oldIdx >= 0 && oldIdx < TABS.length) {
      morphProgress[oldIdx].value = withSpring(0, SPRING_CONFIG);
      iconScale[oldIdx].value = withSpring(1, SPRING_CONFIG);
      // Reset rotación del tab anterior si es sparkles
      if (TABS[oldIdx].name === 'ai-chat') {
        iconRotation[oldIdx].value = withTiming(0, { duration: 200 });
      }
    }

    // Activar nuevo tab
    morphProgress[currentIndex].value = withSpring(1, SPRING_CONFIG);
    iconScale[currentIndex].value = withSpring(1.12, SCALE_SPRING);

    // Rotación especial para sparkles (Asistente)
    if (TABS[currentIndex].name === 'ai-chat') {
      iconRotation[currentIndex].value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 })
      );
    }

    // Haptic feedback sutil al cambiar de tab
    haptic('light');

    prevIndex.value = currentIndex;
  }, [currentIndex]);

  // Animación del indicador deslizante
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
        backgroundColor: themeColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: insets.bottom + 8,
        paddingTop: 8,
        height: 70 + insets.bottom,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 10,
      }}
    >
      {/* Indicador deslizante redondeado con Reanimated */}
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

        // Estilo animado para el contenedor del icono
        const iconContainerStyle = useAnimatedStyle(() => {
          const scale = iconScale[index].value;
          return {
            transform: [{ scale }],
          };
        });

        // Estilo animado para el icono outline (se desvanece cuando está activo)
        const outlineIconStyle = useAnimatedStyle(() => ({
          opacity: 1 - morphProgress[index].value,
          transform: [
            { scale: interpolate(morphProgress[index].value, [0, 1], [1, 0.8]) },
          ],
        }));

        // Estilo animado para el icono filled (aparece cuando está activo)
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
                  backgroundColor: isActive ? themeColors.primary + '18' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 3,
                },
                iconContainerStyle,
              ]}
            >
              {/* Icono outline (se desvanece) */}
              <Animated.View style={outlineIconStyle}>
                <Ionicons
                  name={tab.icon as any}
                  size={24}
                  color={isActive ? themeColors.primary : themeColors.textSecondary}
                />
              </Animated.View>

              {/* Icono filled (aparece con morphing) */}
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
                color: isActive ? themeColors.primary : themeColors.textSecondary,
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
