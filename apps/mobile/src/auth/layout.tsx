import type { PropsWithChildren, ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { designTokens, palettes, useTheme } from '../theme';
import brandMark from '../../assets/brand/web/pwa-192.png';

export function AuthLayout({ children, controls }: PropsWithChildren<{ controls: ReactNode }>) {
  const { width } = useWindowDimensions();
  const { language } = useI18n();
  const colors = useTheme();
  const desktop = width >= designTokens.breakpoints.desktop;
  const dark = palettes.dark;
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        {...(Platform.OS === 'ios' ? { behavior: 'padding' as const } : {})}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: desktop ? 32 : 12,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 1280,
              alignSelf: 'center',
              flexDirection: desktop ? 'row' : 'column',
              borderWidth: 1,
              borderColor: dark.border,
              borderRadius: designTokens.radius.xl,
              overflow: 'hidden',
            }}
          >
            <View
              testID="auth-introduction"
              style={{
                flex: desktop ? 1 : undefined,
                minWidth: 0,
                padding: desktop ? 48 : 24,
                gap: desktop ? 48 : 20,
                backgroundColor: dark.background,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image
                  source={brandMark}
                  style={{ width: 48, height: 48, borderRadius: designTokens.radius.md }}
                  accessibilityIgnoresInvertColors
                  accessible={false}
                />
                <Text
                  style={{
                    color: dark.ink,
                    fontFamily: designTokens.typography.family,
                    fontSize: 23,
                    fontWeight: '800',
                    letterSpacing: -0.7,
                  }}
                >
                  FinTrack{' '}
                  <Text style={{ color: designTokens.brand.orangeLight, fontWeight: '500' }}>
                    Pro
                  </Text>
                </Text>
              </View>
              <View style={{ gap: desktop ? 24 : 12 }}>
                {desktop ? (
                  <Text
                    style={{
                      color: dark.muted,
                      fontFamily: designTokens.typography.family,
                      fontSize: 11,
                      letterSpacing: 2.5,
                      fontWeight: '700',
                    }}
                  >
                    {text('CLAREZA PARA AS SUAS ESCOLHAS', 'CLARITY FOR YOUR NEXT MOVE')}
                  </Text>
                ) : null}
                <Text
                  accessibilityRole="header"
                  style={{
                    color: dark.ink,
                    fontFamily: designTokens.typography.family,
                    fontSize: desktop ? 52 : 29,
                    lineHeight: desktop ? 59 : 36,
                    fontWeight: '800',
                    letterSpacing: desktop ? -2 : -0.8,
                    maxWidth: 440,
                  }}
                >
                  {text('Suas finanças\nsob controle.', 'Your finances.\nIn your control.')}
                </Text>
                {desktop ? (
                  <Text
                    style={{
                      color: dark.muted,
                      fontFamily: designTokens.typography.family,
                      fontSize: 17,
                      lineHeight: 28,
                      maxWidth: 390,
                    }}
                  >
                    {text(
                      'Organize suas contas, acompanhe seus gastos e tenha uma visão clara do seu dinheiro em um só lugar.',
                      'Organize your accounts, track your spending and see your money clearly, all in one place.',
                    )}
                  </Text>
                ) : null}
              </View>
              {desktop ? (
                <View style={{ gap: 22 }}>
                  <View
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      padding: 24,
                      borderRadius: designTokens.radius.lg,
                      backgroundColor: dark.sidebar,
                      borderWidth: 1,
                      borderColor: dark.border,
                      gap: 22,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View
                        style={{
                          width: 70,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: dark.muted,
                          opacity: 0.55,
                        }}
                      />
                      <View
                        style={{
                          width: 26,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: designTokens.brand.orange,
                        }}
                      />
                    </View>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 100 }}
                    >
                      {[30, 46, 36, 64, 55, 78, 94].map((height, index) => (
                        <View
                          key={index}
                          style={{
                            flex: 1,
                            height,
                            borderRadius: 5,
                            backgroundColor:
                              index === 6 ? designTokens.brand.orange : dark.elevated,
                            borderTopWidth: index === 6 ? 3 : 1,
                            borderColor: index === 6 ? designTokens.brand.orangeLight : dark.border,
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ height: 1, backgroundColor: dark.border }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[100, 62, 42].map((value) => (
                        <View
                          key={value}
                          style={{
                            flex: value,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor:
                              value === 100 ? designTokens.brand.orange : dark.border,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  <Text
                    style={{
                      color: dark.muted,
                      fontFamily: designTokens.typography.family,
                      fontSize: 13,
                      lineHeight: 21,
                    }}
                  >
                    {text(
                      'Contas, categorias e movimentações.\nMais organização para o que importa.',
                      'Accounts, categories and transactions.\nMore room for what matters.',
                    )}
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              testID="auth-form-panel"
              style={{
                flex: desktop ? 1.05 : undefined,
                minWidth: 0,
                backgroundColor: colors.sidebar,
                paddingHorizontal: desktop ? 48 : 20,
                paddingVertical: desktop ? 32 : 24,
                gap: 32,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  gap: 4,
                }}
              >
                {controls}
              </View>
              <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 24 }}>
                {children}
              </View>
              <Text
                style={{
                  color: colors.muted,
                  textAlign: 'center',
                  fontFamily: designTokens.typography.family,
                  fontSize: 12,
                  lineHeight: 20,
                }}
              >
                {text('Seus dados. Seu controle.', 'Your data. Your control.')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
