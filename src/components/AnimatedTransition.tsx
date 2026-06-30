import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedTransitionProps {
  children: ReactNode;
}

/**
 * AnimatedTransition - Envuelve el contenido de cada tab
 * y aplica una animación combinada de Slide Horizontal + Fade + Scale
 * cuando la ruta cambia.
 *
 * Efecto premium tipo Monzo/Revolut:
 * - Slide horizontal (300ms)
 * - Fade simultáneo
 * - Scale sutil (0.98 → 1.0)
 */
export default function AnimatedTransition({ children }: AnimatedTransitionProps) {
  const themeColors = useThemeColors();
  const pathname = usePathname();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;

    // Determinar dirección del slide
    const tabOrder = ['/(tabs)', '/(tabs)/accounts', '/(tabs)/transactions', '/(tabs)/budgets', '/(tabs)/goals', '/(tabs)/settings'];
    const prevIndex = tabOrder.indexOf(prevPath.current);
    const currIndex = tabOrder.indexOf(pathname);
    const goingForward = currIndex > prevIndex;

    // Resetear animación
    slideAnim.setValue(goingForward ? SCREEN_WIDTH * 0.15 : -SCREEN_WIDTH * 0.15);
    fadeAnim.setValue(0.7);
    scaleAnim.setValue(0.97);

    // Animar entrada
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }),
    ]).start();

    prevPath.current = pathname;
  }, [pathname]);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: themeColors.background,
        transform: [
          { translateX: slideAnim },
          { scale: scaleAnim },
        ],
        opacity: fadeAnim,
      }}
    >
      {children}
    </Animated.View>
  );
}
