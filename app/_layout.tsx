import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAccounts } from '../src/store/useAccounts';
import { useSettings } from '../src/store/useSettings';
import { colors } from '../src/theme/colors';
import { ensureDatabaseInitialized } from '../src/services/database';

export default function RootLayout() {
  const loadAccounts = useAccounts((state) => state.loadAccounts);
  const useDarkMode = useSettings((state) => state.useDarkMode);
  const loadDeepseekKey = useSettings((state) => state.loadDeepseekKey);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Inicializar BD antes que cualquier componente la necesite
        await ensureDatabaseInitialized();
        setDbReady(true);
        // Cargar cuentas después de que la BD esté lista
        await loadAccounts();
        // Cargar API Key desde SecureStore (cifrado)
        await loadDeepseekKey();
      } catch (e: any) {
        console.error('Error inicializando la aplicación:', e);
        setDbError(e?.message || 'Error al inicializar la base de datos');
      }
    }
    init();
  }, []);

  const themeColors = useDarkMode ? colors.dark : colors.light;

  // Pantalla de carga mientras se inicializa la BD
  if (!dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' }}>
        {dbError ? (
          <>
            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Error de inicialización
            </Text>
            <Text style={{ color: themeColors.textSecondary, fontSize: 14, textAlign: 'center', marginHorizontal: 40 }}>
              {dbError}
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 14, marginTop: 12 }}>
              Inicializando...
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <StatusBar style={useDarkMode ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account/new" options={{ presentation: 'modal', headerShown: true, title: 'Nueva Cuenta', contentStyle: { backgroundColor: themeColors.background } }} />
          <Stack.Screen name="account/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Detalle de Cuenta', contentStyle: { backgroundColor: themeColors.background } }} />
          <Stack.Screen name="ai-chat" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
