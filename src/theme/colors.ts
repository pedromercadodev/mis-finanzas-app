export type ThemeColorSet = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceVariant: string;
  primary: string;
  primaryLight: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryLight: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryLight: string;
  tertiaryContainer: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  onSurfaceVariant: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  errorContainer: string;
  warning: string;
  warningLight: string;
  usd: string;
  bs: string;
  border: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  cardShadow: string;
  overlay: string;
  /** Colores para gráficos (chart) que se adaptan al tema */
  chartColors: string[];
};

export const colors: { light: ThemeColorSet; dark: ThemeColorSet } = {
  // Modo Claro — Paleta adaptada de Kinetic Ledger para modo claro
  light: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceContainer: '#EEEEF2',
    surfaceContainerHigh: '#E4E4E9',
    surfaceContainerHighest: '#D8D8DF',
    surfaceVariant: '#E8E8ED',
    primary: '#565E74',
    primaryLight: '#EEF0FF',
    primaryContainer: '#E8E8F0',
    onPrimaryContainer: '#3F465C',
    secondary: '#059669',
    secondaryLight: '#ECFDF5',
    secondaryContainer: '#A7F3D0',
    onSecondaryContainer: '#003824',
    tertiary: '#D97706',
    tertiaryLight: '#FFFBEB',
    tertiaryContainer: '#FDE68A',
    text: '#0D0D12',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    onSurfaceVariant: '#6B7280',
    success: '#059669',
    successLight: '#ECFDF5',
    danger: '#DC2626',
    dangerLight: '#FEF2F2',
    errorContainer: '#FEE2E2',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    usd: '#059669',
    bs: '#D97706',
    border: '#E5E7EB',
    outline: '#909097',
    outlineVariant: '#D1D5DB',
    shadow: 'rgba(0,0,0,0.04)',
    cardShadow: 'rgba(91,91,214,0.08)',
    overlay: 'rgba(0,0,0,0.3)',
    chartColors: [
      '#059669', '#D97706', '#565E74', '#7C7CE6',
      '#EC4899', '#F43F5E', '#EF4444', '#F97316',
      '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
      '#3B82F6', '#8B5CF6', '#A855F7', '#D946EF',
    ],
  },
  // Modo Oscuro — Paleta Kinetic Ledger (dark-mode-first)
  dark: {
    background: '#081425',
    surface: '#081425',
    surfaceElevated: '#152031',
    surfaceContainer: '#152031',
    surfaceContainerHigh: '#1f2a3c',
    surfaceContainerHighest: '#2a3548',
    surfaceVariant: '#2a3548',
    primary: '#bec6e0',
    primaryLight: '#1A1A3E',
    primaryContainer: '#0f172a',
    onPrimaryContainer: '#798098',
    secondary: '#4edea3',
    secondaryLight: '#052E16',
    secondaryContainer: '#00a572',
    onSecondaryContainer: '#00311f',
    tertiary: '#ffb95f',
    tertiaryLight: '#451A03',
    tertiaryContainer: '#251400',
    text: '#d8e3fb',
    textSecondary: '#c6c6cd',
    textTertiary: '#909097',
    onSurfaceVariant: '#c6c6cd',
    success: '#4edea3',
    successLight: '#052E16',
    danger: '#ffb4ab',
    dangerLight: '#450A0A',
    errorContainer: '#93000a',
    warning: '#ffb95f',
    warningLight: '#451A03',
    usd: '#4edea3',
    bs: '#ffb95f',
    border: '#1E1E30',
    outline: '#909097',
    outlineVariant: '#45464d',
    shadow: 'rgba(0,0,0,0.4)',
    cardShadow: 'rgba(78,222,163,0.08)',
    overlay: 'rgba(0,0,0,0.6)',
    chartColors: [
      '#4edea3', '#ffb95f', '#bec6e0', '#A78BFA',
      '#F472B6', '#FB7185', '#F87171', '#FB923C',
      '#FACC15', '#4ADE80', '#2DD4BF', '#22D3EE',
      '#60A5FA', '#7C7CE6', '#C084FC', '#E879F9',
    ],
  },
} as const;

export const accountColors = [
  { name: 'Binance', hex: '#F0B90B' },
  { name: 'Facebank', hex: '#059669' },
  { name: 'Tarjeta', hex: '#7C7CE6' },
  { name: 'Efectivo', hex: '#F97316' },
  { name: 'Banco', hex: '#DC2626' },
  { name: 'Otra', hex: '#EC4899' },
] as const;

export const categoryIcons: Record<string, string> = {
  Comida: 'fast-food-outline',
  Transporte: 'car-outline',
  Salud: 'medkit-outline',
  Educación: 'book-outline',
  Entretenimiento: 'game-controller-outline',
  Vivienda: 'home-outline',
  Servicios: 'flash-outline',
  Ropa: 'shirt-outline',
  Salario: 'wallet-outline',
  Freelance: 'laptop-outline',
  Inversiones: 'trending-up-outline',
  Otros: 'cube-outline',
};
