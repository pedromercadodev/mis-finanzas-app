import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { typography } from '../theme/typography';

type EmptyStateVariant = 'transactions' | 'search' | 'accounts' | 'goals' | 'subscriptions' | 'debts' | 'budgets' | 'reports';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const DEFAULT_CONFIG: Record<EmptyStateVariant, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  transactions: {
    icon: 'receipt-outline',
    title: 'Sin transacciones',
    subtitle: 'Toca el botón + para registrar tu primer movimiento',
  },
  search: {
    icon: 'search-outline',
    title: 'Sin resultados',
    subtitle: 'Intenta con otros filtros o palabras clave',
  },
  accounts: {
    icon: 'wallet-outline',
    title: 'Sin cuentas',
    subtitle: 'Agrega una cuenta bancaria o billetera para empezar',
  },
  goals: {
    icon: 'flag-outline',
    title: 'Sin metas',
    subtitle: 'Define una meta de ahorro para empezar a seguir tu progreso',
  },
  subscriptions: {
    icon: 'calendar-outline',
    title: 'Sin suscripciones',
    subtitle: 'Agrega tus suscripciones mensuales para no olvidar pagos',
  },
  debts: {
    icon: 'cash-outline',
    title: 'Sin deudas',
    subtitle: 'Registra tus deudas para llevar un control de pagos',
  },
  budgets: {
    icon: 'pie-chart-outline',
    title: 'Sin presupuestos',
    subtitle: 'Crea un presupuesto mensual para controlar tus gastos',
  },
  reports: {
    icon: 'bar-chart-outline',
    title: 'Sin datos',
    subtitle: 'No hay suficientes datos para mostrar reportes',
  },
};

/**
 * EmptyState — estado vacío con icono flotante y glow sutil.
 *
 * Principios aplicados:
 * - Emil §3: espaciado generoso (paddingVertical: 64), sin bordes
 * - Apple §12: jerarquía visual con glow en icono
 * - Apple §5: spring-based floating animation (vs timing linear)
 * - Apple §16: reduced motion respetado
 */
export default function EmptyState({
  variant = 'transactions',
  title,
  subtitle,
  icon,
}: EmptyStateProps) {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const config = DEFAULT_CONFIG[variant];

  const floatAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(reducedMotion ? 1 : 0.85);
  const opacityAnim = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    // Floating animation con spring — más natural que timing linear
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2500 }),
        withTiming(0, { duration: 2500 })
      ),
      -1,
      true
    );

    // Entrada con spring — efecto "pop" sutil
    scaleAnim.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.6 });
    opacityAnim.value = withTiming(1, { duration: 300 });
  }, [reducedMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 64,
          paddingHorizontal: 32,
        },
        containerStyle,
      ]}
    >
      <Animated.View style={floatStyle}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: themeColors.primaryLight,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            // Glow sutil con sombra tintada
            shadowColor: themeColors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Ionicons
            name={icon || config.icon}
            size={38}
            color={themeColors.primary}
          />
        </View>
      </Animated.View>
      <Text
        style={{
          ...typography.h3,
          color: themeColors.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title || config.title}
      </Text>
      <Text
        style={{
          ...typography.body,
          color: themeColors.textSecondary,
          textAlign: 'center',
          maxWidth: 260,
        }}
      >
        {subtitle || config.subtitle}
      </Text>
    </Animated.View>
  );
}
