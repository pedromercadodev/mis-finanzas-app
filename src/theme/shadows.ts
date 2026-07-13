import { ViewStyle } from 'react-native';

/**
 * Sistema de sombras unificadas estilo Apple/Linear.
 * Multi-capa: combina shadow suave (difusa) + shadow más definida (direccional).
 * Compatible con iOS (shadow*) y Android (elevation).
 * Sin bordes sólidos — toda la profundidad viene de las sombras.
 */

export const shadows = {
  /** Elementos sutiles (chips, badges) — apenas perceptible */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  /** Tarjetas estándar, items de lista */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,

  /** Tarjetas destacadas, modales pequeños */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  } as ViewStyle,

  /** Elementos flotantes (FAB, toasts, sheets) */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  } as ViewStyle,

  /** Sombras con tintado de color primario (para tarjetas de saldo, CTA) */
  primary: {
    shadowColor: '#5B5BD6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  } as ViewStyle,

  /** Sombra interna sutil (para indicador de segmented control) */
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  } as ViewStyle,
} as const;

export type ShadowLevel = keyof typeof shadows;
