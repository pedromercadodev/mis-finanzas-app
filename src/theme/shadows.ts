import { ViewStyle } from 'react-native';

/**
 * Sistema de sombras unificadas para la app.
 * 3 niveles: sm (pequeña), md (mediana), lg (grande)
 * Compatible con iOS (shadow*) y Android (elevation).
 */

export const shadows = {
  /** Tarjetas pequeñas, chips, elementos sutiles */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  } as ViewStyle,

  /** Tarjetas estándar, modales, dropdowns */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  } as ViewStyle,

  /** FAB, toasts, elementos flotantes */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  } as ViewStyle,

  /** Modales, elementos que deben destacar mucho */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  } as ViewStyle,
} as const;

export type ShadowLevel = keyof typeof shadows;
