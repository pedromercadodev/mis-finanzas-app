import { Tabs } from 'expo-router';
import { View } from 'react-native';
import AnimatedTabBar from '../../src/components/AnimatedTabBar';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function TabLayout() {
  const themeColors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <AnimatedTransition>
        <Tabs
          tabBar={() => <AnimatedTabBar />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="transactions" />
          <Tabs.Screen name="reports" />
          <Tabs.Screen name="settings" />
          {/* Rutas ocultas de la tab bar (accesibles por navegación interna) */}
          <Tabs.Screen name="accounts" options={{ href: null }} />
          <Tabs.Screen name="budgets" options={{ href: null }} />
          <Tabs.Screen name="goals" options={{ href: null }} />
          <Tabs.Screen name="subscriptions" options={{ href: null }} />
          <Tabs.Screen name="debts" options={{ href: null }} />
        </Tabs>
      </AnimatedTransition>
    </View>
  );
}
