import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Head } from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePreferences } from '../src/preferences';
import { Button, Card, ErrorState, Loading, Screen } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { useI18n } from '../src/i18n';
import { useDemo } from '../src/demo';

export default function RootLayout() {
  const { status, error, hydrate, reset, saving } = usePreferences();
  const { hydrate: hydrateDemo } = useDemo();
  const colors = useTheme();
  const { t, language } = useI18n();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    void hydrateDemo();
  }, [hydrateDemo]);
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = language;
  }, [language]);
  return (
    <SafeAreaProvider>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      <Head>
        <title>{`FinTrack Pro · ${t('brand.tagline')}`}</title>
        <meta name="description" content={t('brand.tagline')} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="FinTrack Pro" />
        <meta property="og:description" content={t('brand.tagline')} />
        <meta property="og:image" content="/social-card.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#FF5A00" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>
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
