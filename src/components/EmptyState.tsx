import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

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

export default function EmptyState({
  variant = 'transactions',
  title,
  subtitle,
  icon,
}: EmptyStateProps) {
  const themeColors = useThemeColors();
  const config = DEFAULT_CONFIG[variant];

  const floatAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    scaleAnim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
    opacityAnim.value = withTiming(1, { duration: 400 });
  }, []);

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
          paddingVertical: 48,
          paddingHorizontal: 32,
        },
        containerStyle,
      ]}
    >
      <Animated.View style={floatStyle}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: themeColors.primaryLight,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons
            name={icon || config.icon}
            size={36}
            color={themeColors.primary}
          />
        </View>
      </Animated.View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: themeColors.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title || config.title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: themeColors.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {subtitle || config.subtitle}
      </Text>
    </Animated.View>
  );
}
