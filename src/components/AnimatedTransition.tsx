import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedTransitionProps {
  children: ReactNode;
}

/**
 * AnimatedTransition - Envuelve el contenido del layout de tabs
 * y aplica una animación combinada de Slide Horizontal + Fade + Scale
 * cuando la ruta cambia entre tabs principales.
 *
 * Incluye:
 * - Bloqueo (animatingRef) para evitar doble ejecución por actualizaciones
 *   intermedias de usePathname().
 * - Loading overlay con skeleton sutil durante la transición.
 */
export default function AnimatedTransition({ children }: AnimatedTransitionProps) {
  const themeColors = useThemeColors();
  const pathname = usePathname();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevPath = useRef(pathname);
  const animatingRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ignorar si es la misma ruta o si ya estamos animando
    if (prevPath.current === pathname) return;
    if (animatingRef.current) return;

    // Solo animar para rutas de tabs conocidas
    const tabOrder = ['/(tabs)', '/(tabs)/accounts', '/(tabs)/transactions', '/(tabs)/budgets', '/(tabs)/goals', '/(tabs)/settings', '/(tabs)/reports', '/(tabs)/subscriptions', '/(tabs)/debts'];
    const prevIndex = tabOrder.indexOf(prevPath.current);
    const currIndex = tabOrder.indexOf(pathname);

    // Si alguna de las rutas no está en tabOrder, no animar
    if (prevIndex === -1 || currIndex === -1) {
      prevPath.current = pathname;
      return;
    }

    const goingForward = currIndex > prevIndex;

    // Marcar que estamos animando para evitar doble ejecución
    animatingRef.current = true;
    setLoading(true);

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
    ]).start(() => {
      // Liberar el bloqueo cuando la animación termina
      animatingRef.current = false;
      setLoading(false);
    });

    prevPath.current = pathname;
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
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

      {/* Loading overlay durante la transición */}
      {loading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: themeColors.background,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
          pointerEvents="none"
        >
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Ionicons name="sync-outline" size={28} color={themeColors.primary} />
            <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
              Cargando...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
