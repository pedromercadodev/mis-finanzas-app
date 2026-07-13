export type ThemeColorSet = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  usd: string;
  bs: string;
  border: string;
  shadow: string;
  cardShadow: string;
  overlay: string;
  /** Colores para gráficos (chart) que se adaptan al tema */
  chartColors: string[];
};

export const colors: { light: ThemeColorSet; dark: ThemeColorSet } = {
  // Modo Claro — Paleta refinada tipo Linear/Vercel
  light: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#5B5BD6',
    primaryLight: '#EEF0FF',
    secondary: '#8B5CF6',
    text: '#0D0D12',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    success: '#059669',
    successLight: '#ECFDF5',
    danger: '#DC2626',
    dangerLight: '#FEF2F2',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    usd: '#059669',
    bs: '#D97706',
    border: '#E5E7EB',
    shadow: 'rgba(0,0,0,0.04)',
    cardShadow: 'rgba(91,91,214,0.08)',
    overlay: 'rgba(0,0,0,0.3)',
    chartColors: [
      '#5B5BD6', '#8B5CF6', '#A855F7', '#D946EF',
      '#EC4899', '#F43F5E', '#EF4444', '#F97316',
      '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
      '#3B82F6', '#5B5BD6', '#8B5CF6', '#A855F7',
    ],
  },
  // Modo Oscuro — Fondo más profundo, mejor contraste
  dark: {
    background: '#0A0A0F',
    surface: '#14141F',
    surfaceElevated: '#1C1C2E',
    primary: '#7C7CE6',
    primaryLight: '#1A1A3E',
    secondary: '#A78BFA',
    text: '#F1F1F7',
    textSecondary: '#8B8BA0',
    textTertiary: '#6B6B80',
    success: '#34D399',
    successLight: '#052E16',
    danger: '#F87171',
    dangerLight: '#450A0A',
    warning: '#FBBF24',
    warningLight: '#451A03',
    usd: '#6EE7B7',
    bs: '#FCD34D',
    border: '#1E1E30',
    shadow: 'rgba(0,0,0,0.4)',
    cardShadow: 'rgba(124,124,230,0.08)',
    overlay: 'rgba(0,0,0,0.6)',
    chartColors: [
      '#7C7CE6', '#A78BFA', '#C084FC', '#E879F9',
      '#F472B6', '#FB7185', '#F87171', '#FB923C',
      '#FACC15', '#4ADE80', '#2DD4BF', '#22D3EE',
      '#60A5FA', '#7C7CE6', '#A78BFA', '#C084FC',
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
