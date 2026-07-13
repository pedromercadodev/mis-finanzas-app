import { TextStyle, Platform } from 'react-native';

/**
 * Sistema de tipografía unificada estilo Apple.
 * - Tracking (letter-spacing) es específico por tamaño: negativo en grande, neutro en cuerpo
 * - Leading (line-height) inverso: apretado en títulos grandes, holgado en cuerpo
 * - Jerarquía construida desde weight + size + leading como conjunto
 * - Usa la fuente del sistema (SF Pro en iOS, Roboto en Android)
 */

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  /** Display grande — solo para montos principales */
  display: {
    fontFamily,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 44,
  } as TextStyle,

  /** Títulos grandes de pantalla (ej: saldo total) */
  h1: {
    fontFamily,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 36,
  } as TextStyle,

  /** Títulos de sección */
  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 28,
  } as TextStyle,

  /** Subtítulos */
  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  } as TextStyle,

  /** Encabezados de tarjetas */
  h4: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
  } as TextStyle,

  /** Cuerpo de texto principal */
  body: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 22,
  } as TextStyle,

  /** Texto mediano (subtítulos de tarjetas) */
  bodyMedium: {
    fontFamily,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
  } as TextStyle,

  /** Texto secundario / metadatos */
  caption: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.02,
    lineHeight: 18,
  } as TextStyle,

  /** Texto pequeño (etiquetas, chips) */
  small: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.04,
    lineHeight: 16,
  } as TextStyle,

  /** Montos grandes (saldo principal) */
  amountLarge: {
    fontFamily,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
  } as TextStyle,

  /** Montos medianos (transacciones) */
  amountMedium: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  } as TextStyle,

  /** Montos pequeños (USD secundario) */
  amountSmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
  } as TextStyle,

  /** Botones primarios */
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 22,
  } as TextStyle,

  /** Botones secundarios / chips */
  buttonSmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.02,
    lineHeight: 18,
  } as TextStyle,

  /** Badges / contadores */
  badge: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.06,
    lineHeight: 14,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
