import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAccounts } from '../src/store/useAccounts';
import { useSettings } from '../src/store/useSettings';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  const loadAccounts = useAccounts((state) => state.loadAccounts);
  const useDarkMode = useSettings((state) => state.useDarkMode);

  useEffect(() => {
    loadAccounts();
  }, []);

  const themeColors = useDarkMode ? colors.dark : colors.light;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={useDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account/new" options={{ presentation: 'modal', headerShown: true, title: 'Nueva Cuenta', contentStyle: { backgroundColor: themeColors.background } }} />
        <Stack.Screen name="account/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Detalle de Cuenta', contentStyle: { backgroundColor: themeColors.background } }} />
        <Stack.Screen name="ai-chat" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </View>
  );
}
