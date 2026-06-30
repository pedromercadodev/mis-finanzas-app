import { colors } from '../theme/colors';
import { useSettings } from '../store/useSettings';

export function useThemeColors() {
  const { useDarkMode } = useSettings();
  return useDarkMode ? colors.dark : colors.light;
}
