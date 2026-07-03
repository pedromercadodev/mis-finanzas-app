import { useColorScheme } from 'react-native';
import { colors } from '../theme/colors';
import { useSettings } from '../store/useSettings';
import type { ThemeColorSet } from '../theme/colors';

export function useThemeColors(): ThemeColorSet {
  const systemColorScheme = useColorScheme();
  const { themeMode, useDarkMode } = useSettings();

  // Determinar si debe usar modo oscuro
  let isDark: boolean;
  switch (themeMode) {
    case 'light':
      isDark = false;
      break;
    case 'dark':
      isDark = true;
      break;
    case 'system':
    default:
      isDark = systemColorScheme === 'dark';
      break;
  }

  // Fallback: si el usuario tenía configurado useDarkMode antes de la migración a themeMode
  if (themeMode === 'system' && useDarkMode) {
    isDark = true;
  }

  return isDark ? colors.dark : colors.light;
}
