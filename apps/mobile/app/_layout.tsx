import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePreferences } from '../src/preferences';
import { Button, Card, ErrorState, Loading, Screen } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { useI18n } from '../src/i18n';

export default function RootLayout() {
  const { status, error, hydrate, reset, saving } = usePreferences();
  const colors = useTheme();
  const { t } = useI18n();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return (
    <SafeAreaProvider>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      {status !== 'ready' ? (
        <Screen title={t('shell.workspace')} subtitle={t('brand.tagline')}>
          {status === 'loading' ? (
            <Loading />
          ) : (
            <Card>
              <ErrorState
                message={
                  error === 'invalid' ? t('common.invalidPreferences') : t('common.readError')
                }
                retry={() => {
                  void hydrate();
                }}
              />
              <Button
                label={t('common.restore')}
                disabled={saving}
                variant="secondary"
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
