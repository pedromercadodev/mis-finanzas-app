import { useEffect, ReactNode } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedScreenProps {
  children: ReactNode;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

/**
 * Wrapper animado para pantallas modales.
 * Aplica slide-up + scale (0.95→1.0) + fade-in al montar el componente.
 * Respeta prefers-reduced-motion: si está activado, muestra el contenido
 * directamente sin animación.
 */
export default function AnimatedScreen({ children }: AnimatedScreenProps) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(reducedMotion ? 0 : 60);
  const scale = useSharedValue(reducedMotion ? 1 : 0.95);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    // Animar entrada
    translateY.value = withSpring(0, SPRING_CONFIG);
    scale.value = withSpring(1, SPRING_CONFIG);
    opacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
