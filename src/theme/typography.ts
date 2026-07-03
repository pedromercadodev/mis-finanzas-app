import { TextStyle, Platform } from 'react-native';

/**
 * Sistema de tipografía unificada para la app.
 * Usa la fuente del sistema (SF Pro en iOS, Roboto en Android)
 * con pesos y tamaños consistentes.
 */

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  /** Títulos grandes de pantalla (ej: saldo total) */
  h1: {
    fontFamily,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,

  /** Títulos de sección */
  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,

  /** Subtítulos */
  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '700',
  } as TextStyle,

  /** Encabezados de tarjetas */
  h4: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,

  /** Cuerpo de texto principal */
  body: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400',
  } as TextStyle,

  /** Texto mediano (subtítulos de tarjetas) */
  bodyMedium: {
    fontFamily,
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,

  /** Texto secundario / metadatos */
  caption: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400',
  } as TextStyle,

  /** Texto pequeño (etiquetas, chips) */
  small: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,

  /** Montos grandes (saldo principal) */
  amountLarge: {
    fontFamily,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,

  /** Montos medianos (transacciones) */
  amountMedium: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,

  /** Montos pequeños (USD secundario) */
  amountSmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,

  /** Botones primarios */
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,

  /** Botones secundarios / chips */
  buttonSmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,

  /** Badges / contadores */
  badge: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
