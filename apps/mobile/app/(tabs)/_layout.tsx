import { useState, type ReactNode } from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ColorValue,
} from 'react-native';
import { useI18n } from '../../src/i18n';
import type { TranslationKey } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { designTokens } from '../../src/theme';
import { useTheme } from '../../src/theme';

const navigation = [
  { key: 'overview', route: '/', icon: '◈', implemented: true },
  { key: 'activity', route: '/activity', icon: '↗', implemented: true },
  { key: 'accounts', route: '/accounts', icon: '◫', implemented: true },
  { key: 'cards', route: '/cards', icon: '▱', implemented: true },
  { key: 'budgets', route: '', icon: '◷', implemented: false },
  { key: 'goals', route: '', icon: '◎', implemented: false },
  { key: 'reports', route: '', icon: '▤', implemented: false },
  { key: 'settings', route: '/preferences', icon: '⚙', implemented: true },
] as const;

function DesktopNavItem({
  label,
  status,
  shortStatus,
  icon,
  active,
  collapsed,
  disabled,
  onPress,
}: {
  label: string;
  status: string;
  shortStatus: string;
  icon: string;
  active: boolean;
  collapsed: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  const colors = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        accessibilityRole={disabled ? 'text' : 'button'}
        accessibilityLabel={disabled ? `${label}. ${status}` : label}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: 13,
          paddingHorizontal: collapsed ? 0 : 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 13,
          backgroundColor: active ? colors.elevated : 'transparent',
          borderWidth: focused || active ? 2 : 1,
          borderColor: focused ? colors.accent : active ? colors.border : 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        })}
      >
        <Text
          accessibilityElementsHidden
          style={{
            width: 22,
            textAlign: 'center',
            color: active ? colors.accent : colors.muted,
            fontSize: 18,
            fontWeight: '700',
          }}
        >
          {icon}
        </Text>
        {!collapsed ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                flex: 1,
                color: active ? colors.ink : colors.muted,
                fontSize: 14,
                fontWeight: active ? '700' : '600',
              }}
            >
              {label}
            </Text>
            {disabled ? (
              <Text style={{ color: colors.muted, fontSize: 9, fontWeight: '800' }}>
                {shortStatus}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {collapsed && hovered ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 58,
            top: 4,
            zIndex: 10,
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 9,
            paddingHorizontal: 11,
            paddingVertical: 8,
            minWidth: 140,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>
            {disabled ? `${label} · ${status}` : label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DesktopShell({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  const colors = useTheme();
  const { t, language } = useI18n();
  const { update } = usePreferences();
  const pathname = usePathname();
  const currentPage =
    navigation.find(
      (item) => item.route && (pathname === item.route || pathname.endsWith(item.route)),
    ) ?? navigation[0];
  const currentTitle = t(`nav.${currentPage.key}` as TranslationKey);
  const sidebarWidth = collapsed ? 82 : 252;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width: sidebarWidth,
          backgroundColor: colors.sidebar,
          borderRightColor: colors.border,
          borderRightWidth: 1,
          paddingHorizontal: collapsed ? 14 : 18,
          paddingVertical: 22,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: 30 }}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="FinTrack Pro"
            onPress={() => router.push('/')}
            style={{
              minHeight: 46,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 11,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accentInk, fontWeight: '900', fontSize: 17 }}>F</Text>
            </View>
            {!collapsed ? (
              <View style={{ gap: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 }}>
                  FinTrack <Text style={{ color: colors.accent }}>Pro</Text>
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{t('brand.tagline')}</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={{ gap: 6 }}>
            {!collapsed ? (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                  marginHorizontal: 12,
                  marginBottom: 4,
                }}
              >
                {t('shell.workspace').toLocaleUpperCase()}
              </Text>
            ) : null}
            {navigation.map((item) => {
              const label = t(`nav.${item.key}` as Parameters<typeof t>[0]);
              const active = item.route === '/' ? pathname === '/' : pathname.endsWith(item.route);
              return (
                <DesktopNavItem
                  key={item.key}
                  label={label}
                  status={t('nav.inDevelopment')}
                  shortStatus={t('nav.inDevelopmentShort')}
                  icon={item.icon}
                  active={active}
                  collapsed={collapsed}
                  disabled={!item.implemented}
                  onPress={() => item.route && router.push(item.route)}
                />
              );
            })}
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 4,
            }}
          />
          {!collapsed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7 }}>
              <View
                style={{
                  width: 9,
                  height: 9,
                  backgroundColor: colors.positive,
                  borderRadius: 5,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>{t('shell.local')}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? t('shell.expand') : t('shell.collapse')}
            onPress={() => update({ desktopSidebarCollapsed: !collapsed })}
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: collapsed ? 'center' : 'flex-start',
              justifyContent: 'center',
              paddingHorizontal: collapsed ? 0 : 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {collapsed ? '⇥' : `⇤   ${t('shell.collapse')}`}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            minHeight: 74,
            paddingHorizontal: 34,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ gap: 3 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {t('shell.workspace')} · {currentTitle}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
              {currentTitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shell.theme')}
              onPress={() => update({ theme: colors.mode === 'dark' ? 'light' : 'dark' })}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 13,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text accessibilityElementsHidden style={{ color: colors.accent, fontSize: 17 }}>
                {colors.mode === 'dark' ? '☼' : '◐'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shell.language')}
              onPress={() => update({ language: language === 'pt-BR' ? 'en' : 'pt-BR' })}
              style={({ pressed }) => ({
                minWidth: 52,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 13,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 12 }}>
                {language === 'pt-BR' ? 'PT' : 'EN'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useTheme();
  const { t } = useI18n();
  const { value } = usePreferences();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= designTokens.breakpoints.desktop;
  const icon =
    (symbol: string) =>
    ({ color }: { color: ColorValue }) => (
      <Text style={{ color, fontSize: 19, fontWeight: '700' }} accessibilityElementsHidden>
        {symbol}
      </Text>
    );
  const screens = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          display: isDesktop ? 'none' : 'flex',
          backgroundColor: colors.sidebar,
          borderTopColor: colors.border,
          minHeight: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.overview'), tabBarIcon: icon('◈') }} />
      <Tabs.Screen
        name="activity"
        options={{ title: t('nav.activityTab'), tabBarIcon: icon('↗') }}
      />
      <Tabs.Screen name="accounts" options={{ title: t('nav.accounts'), tabBarIcon: icon('◫') }} />
      <Tabs.Screen name="cards" options={{ title: t('nav.cards'), tabBarIcon: icon('▱') }} />
      <Tabs.Screen
        name="preferences"
        options={{ title: t('nav.settingsTab'), tabBarIcon: icon('⚙') }}
      />
    </Tabs>
  );
  if (!isDesktop) return screens;
  return <DesktopShell collapsed={value.desktopSidebarCollapsed}>{screens}</DesktopShell>;
}
