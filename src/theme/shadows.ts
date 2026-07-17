import { ViewStyle } from 'react-native';

/**
 * Sistema de sombras unificadas estilo Apple/Linear.
 * Multi-capa: combina shadow suave (difusa) + shadow más definida (direccional).
 * Compatible con iOS (shadow*) y Android (elevation).
 *
 * IMPORTANTE: En modo oscuro (fondo #081425), las sombras negras (#000)
 * con opacidad baja son invisibles. Por eso usamos opacidades más altas
 * y colores con matiz azul/púrpura para que contrasten sobre el fondo oscuro.
 */

export const shadows = {
  /** Elementos sutiles (chips, badges) — apenas perceptible */
  sm: {
    shadowColor: '#0A1E3D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,

  /** Tarjetas estándar, items de lista */
  md: {
    shadowColor: '#0A1E3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 4,
  } as ViewStyle,

  /** Tarjetas destacadas, modales pequeños */
  lg: {
    shadowColor: '#0A1E3D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 6,
  } as ViewStyle,

  /** Elementos flotantes (FAB, toasts, sheets) */
  xl: {
    shadowColor: '#0A1E3D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 10,
  } as ViewStyle,

  /** Sombras con tintado de color primario (para tarjetas de saldo, CTA) */
  primary: {
    shadowColor: '#5B5BD6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  /** Sombra interna sutil (para indicador de segmented control) */
  inner: {
    shadowColor: '#0A1E3D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 1,
  } as ViewStyle,
} as const;

export type ShadowLevel = keyof typeof shadows;
