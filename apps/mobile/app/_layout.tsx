import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePreferences } from '../src/preferences';
import { Button, Card, ErrorState, Loading, Screen } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const { status, error, hydrate, reset, saving } = usePreferences();
  const colors = useTheme();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return (
    <SafeAreaProvider>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      {status !== 'ready' ? (
        <Screen
          title="Bem-vindo ao seu espaço"
          subtitle="Suas escolhas acompanham você neste dispositivo."
        >
          {status === 'loading' ? (
            <Loading />
          ) : (
            <Card>
              <ErrorState
                message={
                  error === 'invalid'
                    ? 'As preferências salvas estão danificadas ou usam uma versão incompatível.'
                    : 'Não foi possível acessar as preferências deste dispositivo.'
                }
                retry={() => {
                  void hydrate();
                }}
              />
              <Button
                label="Restaurar preferências padrão"
                disabled={saving}
                secondary
                onPress={() => {
                  void reset();
                }}
              />
            </Card>
          )}
        </Screen>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
