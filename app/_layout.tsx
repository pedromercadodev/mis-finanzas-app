import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAccounts } from '../src/store/useAccounts';
import { useSettings } from '../src/store/useSettings';
import { colors } from '../src/theme/colors';
import { ensureDatabaseInitialized } from '../src/services/database';
import ThemedText from '../src/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';

export default function RootLayout() {
  const loadAccounts = useAccounts((state) => state.loadAccounts);
  const useDarkMode = useSettings((state) => state.useDarkMode);
  const loadDeepseekKey = useSettings((state) => state.loadDeepseekKey);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await ensureDatabaseInitialized();
        setDbReady(true);
        await loadAccounts();
        await loadDeepseekKey();
      } catch (e: any) {
        console.error('Error inicializando la aplicación:', e);
        setDbError(e?.message || 'Error al inicializar la base de datos');
      }
    }
    init();
  }, []);

  const themeColors = useDarkMode ? colors.dark : colors.light;

  // Pantalla de carga moderna — minimalista, sin bordes
  if (!dbReady) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: themeColors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {dbError ? (
          <View style={{ alignItems: 'center', paddingHorizontal: 40, gap: 12 }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: themeColors.dangerLight,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="alert-circle" size={32} color={themeColors.danger} />
            </View>
            <ThemedText type="h4" themeColor="danger" style={{ textAlign: 'center' }}>
              Error de inicialización
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center', lineHeight: 22 }}>
              {dbError}
            </ThemedText>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <ThemedText type="body" themeColor="textTertiary">
              Inicializando...
            </ThemedText>
          </View>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <StatusBar style={useDarkMode ? 'light' : 'dark'} />
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.background },
          animation: 'slide_from_right',
        }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="account/new"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Nueva Cuenta',
              headerStyle: { backgroundColor: themeColors.surface },
              headerTintColor: themeColors.text,
              contentStyle: { backgroundColor: themeColors.background },
            }}
          />
          <Stack.Screen
            name="account/[id]"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Detalle de Cuenta',
              headerStyle: { backgroundColor: themeColors.surface },
              headerTintColor: themeColors.text,
              contentStyle: { backgroundColor: themeColors.background },
            }}
          />
          <Stack.Screen
            name="ai-chat"
            options={{ presentation: 'modal', headerShown: false }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
