import { ReactNode, useEffect, useRef } from 'react';
import { View, Dimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { motion, AnimatePresence } from 'framer-motion';

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
  const prevPath = useRef(pathname);

  const tabOrder = ['/(tabs)', '/(tabs)/accounts', '/(tabs)/transactions', '/(tabs)/budgets', '/(tabs)/goals', '/(tabs)/settings'];
  const prevIndex = tabOrder.indexOf(prevPath.current);
  const currIndex = tabOrder.indexOf(pathname);
  const goingForward = currIndex > prevIndex;

  useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  const variants = {
    initial: {
      x: goingForward ? SCREEN_WIDTH * 0.15 : -SCREEN_WIDTH * 0.15,
      opacity: 0.7,
      scale: 0.97,
    },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
  };

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      variants={variants}
      transition={{
        x: { type: 'spring', stiffness: 100, damping: 12 },
        opacity: { duration: 0.25 },
        scale: { type: 'spring', stiffness: 100, damping: 12 },
      }}
      style={{
        flex: 1,
        backgroundColor: themeColors.background,
        width: '100%',
        minHeight: '100%',
        overflow: 'visible',
      }}
    >
      {children}
    </motion.div>
  );
}
