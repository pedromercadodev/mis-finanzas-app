import { ReactNode, useEffect, useRef } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Curva custom cubic-bezier(0.16, 1, 0.3, 1) — "emphasized ease"
 * usada por Linear/Vercel para transiciones naturales sin rebote excesivo.
 */
const CUSTOM_EASING = Easing.bezier(0.16, 1, 0.3, 1);

/** Spring para slide horizontal — respuesta rápida, poco bounce */
const SPRING_SLIDE = { damping: 22, stiffness: 260, mass: 0.6 };

/** Spring para scale — más firme */
const SPRING_SCALE = { damping: 20, stiffness: 300, mass: 0.5 };

interface AnimatedTransitionProps {
  children: ReactNode;
}

/**
 * AnimatedTransition — transición combinada Slide + Fade + Scale
 * entre tabs. Sin loading overlay (innecesario con animaciones rápidas).
 *
 * Principios aplicados:
 * - Emil §4: custom easing curve, timing reducido
 * - Apple §5: spring damping/response controlado
 * - Apple §16: reduced motion respetado
 */
export default function AnimatedTransition({ children }: AnimatedTransitionProps) {
  const themeColors = useThemeColors();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const slideAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(1);
  const scaleAnim = useSharedValue(1);
  const prevPath = useRef(pathname);
  const animatingRef = useRef(false);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    if (animatingRef.current) return;

    const tabOrder = [
      '/(tabs)', '/(tabs)/accounts', '/(tabs)/transactions',
      '/(tabs)/budgets', '/(tabs)/goals', '/(tabs)/settings',
      '/(tabs)/reports', '/(tabs)/subscriptions', '/(tabs)/debts',
    ];
    const prevIndex = tabOrder.indexOf(prevPath.current);
    const currIndex = tabOrder.indexOf(pathname);

    if (prevIndex === -1 || currIndex === -1) {
      prevPath.current = pathname;
      return;
    }

    const goingForward = currIndex > prevIndex;
    animatingRef.current = true;

    if (reducedMotion) {
      slideAnim.value = 0;
      fadeAnim.value = 1;
      scaleAnim.value = 1;
      animatingRef.current = false;
      prevPath.current = pathname;
      return;
    }

    // Reset — slide más sutil (10% en vez de 15%)
    slideAnim.value = goingForward ? SCREEN_WIDTH * 0.1 : -SCREEN_WIDTH * 0.1;
    fadeAnim.value = 0.85;
    scaleAnim.value = 0.98;

    // Animar con spring para slide + scale, timing para fade
    slideAnim.value = withSpring(0, SPRING_SLIDE);
    fadeAnim.value = withTiming(1, {
      duration: 200,
      easing: CUSTOM_EASING,
    });
    scaleAnim.value = withSpring(1, SPRING_SCALE);

    // Liberar bloqueo después de la animación
    const timer = setTimeout(() => {
      animatingRef.current = false;
    }, 300);

    prevPath.current = pathname;

    return () => clearTimeout(timer);
  }, [pathname, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    backgroundColor: themeColors.background,
    transform: [
      { translateX: slideAnim.value },
      { scale: scaleAnim.value },
    ],
    opacity: fadeAnim.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
