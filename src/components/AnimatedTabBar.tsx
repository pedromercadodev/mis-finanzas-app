import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from 'framer-motion';

const TABS = [
  { name: 'index', title: 'Resumen', icon: 'home-outline', iconActive: 'home' },
  { name: 'transactions', title: 'Movimientos', icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
  { name: 'ai-chat', title: 'Asistente', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'reports', title: 'Reportes', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { name: 'settings', title: 'Ajustes', icon: 'settings-outline', iconActive: 'settings' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / TABS.length;

// En web, framer-motion usa motion.div directamente
// En algunos entornos Expo, puede necesitar motion.create('div')
const MotionDiv = typeof motion.div === 'function' ? motion.div : (motion as any).create?.('div') ?? motion.div;

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

  const navigate = useCallback((name: string) => {
    if (name === 'ai-chat') {
      router.push('/ai-chat');
      return;
    }
    const targetPath = name === 'index' ? '/(tabs)' as const : `/(tabs)/${name}` as const;
    router.push(targetPath);
  }, [router]);

  const indicatorStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: TAB_WIDTH * 0.2,
    width: TAB_WIDTH * 0.6,
    height: 3,
    backgroundColor: themeColors.primary,
    borderRadius: 2,
  }), [themeColors.primary]);

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
      {/* Indicador deslizante con framer-motion */}
      <MotionDiv
        style={indicatorStyle}
        animate={{ x: currentIndex * TAB_WIDTH }}
        transition={{ type: 'spring', stiffness: 120, damping: 10 }}
      />

      {TABS.map((tab, index) => {
        const isActive = index === currentIndex;

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
            <MotionDiv
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 3,
                display: 'flex',
                flexDirection: 'row',
              }}
              animate={{
                scale: isActive ? 1.12 : 1,
                backgroundColor: isActive ? themeColors.primary + '18' : 'transparent',
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 8 }}
            >
              <Ionicons
                name={isActive ? (tab.iconActive as any) : (tab.icon as any)}
                size={isActive ? 24 : 22}
                color={isActive ? themeColors.primary : themeColors.textSecondary}
              />
            </MotionDiv>
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
