import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { name: 'index', title: 'Resumen', icon: 'home-outline', iconActive: 'home' },
  { name: 'transactions', title: 'Movimientos', icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
  { name: 'ai-chat', title: 'Asistente', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'reports', title: 'Reportes', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { name: 'settings', title: 'Ajustes', icon: 'settings-outline', iconActive: 'settings' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / TABS.length;

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

  const slideAnim = useRef(new Animated.Value(currentIndex * TAB_WIDTH)).current;
  const scaleAnims = useRef(TABS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentIndex * TAB_WIDTH,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();

    TABS.forEach((_, i) => {
      Animated.spring(scaleAnims[i], {
        toValue: i === currentIndex ? 1 : 0,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }).start();
    });
  }, [currentIndex]);

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
      {/* Indicador deslizante redondeado */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: TAB_WIDTH * 0.2,
          width: TAB_WIDTH * 0.6,
          height: 3,
          backgroundColor: themeColors.primary,
          borderRadius: 2,
          transform: [{ translateX: slideAnim }],
        }}
      />

      {TABS.map((tab, index) => {
        const isActive = index === currentIndex;
        const scale = scaleAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.12],
        });

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
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: isActive ? themeColors.primary + '18' : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
                transform: [{ scale }],
                marginBottom: 3,
              }}
            >
              <Ionicons
                name={isActive ? (tab.iconActive as any) : (tab.icon as any)}
                size={isActive ? 24 : 22}
                color={isActive ? themeColors.primary : themeColors.textSecondary}
              />
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
