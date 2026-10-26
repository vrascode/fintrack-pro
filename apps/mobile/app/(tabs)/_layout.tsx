import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';

export default function TabLayout() {
  const colors = useTheme();
  const icon =
    (symbol: string) =>
    ({ color }: { color: ColorValue }) => (
      <Text style={{ color, fontSize: 22 }} accessibilityElementsHidden>
        {symbol}
      </Text>
    );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Visão geral', tabBarIcon: icon('◫') }} />
      <Tabs.Screen name="activity" options={{ title: 'Atividade', tabBarIcon: icon('↗') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Contas', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cartões', tabBarIcon: icon('▱') }} />
      <Tabs.Screen name="preferences" options={{ title: 'Ajustes', tabBarIcon: icon('☷') }} />
    </Tabs>
  );
}
