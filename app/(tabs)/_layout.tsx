import { Tabs } from 'expo-router';
import { View } from 'react-native';
import AnimatedTabBar from '../../src/components/AnimatedTabBar';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function TabLayout() {
  const themeColors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Tabs
        tabBar={() => <AnimatedTabBar />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="budgets" />
        <Tabs.Screen name="goals" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="subscriptions" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}
