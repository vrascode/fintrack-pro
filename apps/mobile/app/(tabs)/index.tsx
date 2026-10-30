import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Button, Card, Label, Screen, SectionHeading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { designTokens } from '../../src/theme';
import { useTheme } from '../../src/theme';

function SetupRow({
  number,
  title,
  detail,
  ready = false,
}: {
  number: string;
  title: string;
  detail: string;
  ready?: boolean;
}) {
  const colors = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: ready ? colors.accentSoft : colors.elevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: ready ? colors.accent : colors.muted, fontWeight: '800' }}>
          {ready ? '✓' : number}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14 }}>{title}</Text>
        <Label muted style={{ fontSize: 13, lineHeight: 19 }}>
          {detail}
        </Label>
      </View>
    </View>
  );
}

export default function Overview() {
  const colors = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= designTokens.breakpoints.desktop;
  const compact = width < designTokens.breakpoints.tablet;
  return (
    <Screen eyebrow={t('home.eyebrow')} title={t('home.title')} subtitle={t('home.subtitle')}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        <Card
          accent
          style={{
            flex: wide ? 1.65 : undefined,
            minHeight: compact ? 300 : 340,
            padding: compact ? 22 : 30,
            justifyContent: 'space-between',
            overflow: 'hidden',
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning }}
            />
            <Text
              accessibilityRole="text"
              style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.1, fontWeight: '800' }}
            >
              {t('home.noDataBadge')}
            </Text>
          </View>
          <View style={{ gap: 14, maxWidth: 660 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.ink,
                fontSize: compact ? 25 : 30,
                lineHeight: compact ? 33 : 39,
                fontWeight: '700',
                letterSpacing: -0.8,
              }}
            >
              {t('home.spaceTitle')}
            </Text>
            <Label muted style={{ fontSize: 15, lineHeight: 23 }}>
              {t('home.emptyBody')}
            </Label>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button label={t('home.openAccounts')} onPress={() => router.push('/accounts')} />
            <Button
              label={t('home.openActivity')}
              variant="secondary"
              onPress={() => router.push('/activity')}
            />
          </View>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              right: -52,
              top: -70,
              width: 220,
              height: 220,
              borderRadius: 110,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: 0.55,
            }}
          />
        </Card>

        <Card style={{ flex: wide ? 1 : undefined, justifyContent: 'space-between' }}>
          <View style={{ gap: 7 }}>
            <SectionHeading title={t('home.setupTitle')} detail={t('home.setupDetail')} />
          </View>
          <View style={{ gap: 18 }}>
            <SetupRow
              number="01"
              title={t('home.setupPreferences')}
              detail={t('home.setupPreferencesDetail')}
              ready
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 15 }} />
            <SetupRow
              number="02"
              title={t('home.setupAccounts')}
              detail={t('home.setupAccountsDetail')}
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 15 }} />
            <SetupRow
              number="03"
              title={t('home.setupDashboard')}
              detail={t('home.setupDashboardDetail')}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/preferences')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start' })}
          >
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 }}>
              {t('home.personalize')} ↗
            </Text>
          </Pressable>
        </Card>
      </View>

      <View style={{ gap: 16 }}>
        <SectionHeading title={t('home.availableTitle')} detail={t('home.availableDetail')} />
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}>
          {[
            {
              symbol: '◫',
              title: t('nav.accounts'),
              detail: t('home.accountsCard'),
              path: '/accounts',
            },
            {
              symbol: '↗',
              title: t('nav.activity'),
              detail: t('home.activityCard'),
              path: '/activity',
            },
            {
              symbol: '◷',
              title: t('nav.settings'),
              detail: t('home.settingsCard'),
              path: '/preferences',
            },
          ].map((item) => (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              onPress={() => router.push(item.path)}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
            >
              <Card style={{ flex: 1, minHeight: 136 }}>
                <Text style={{ color: colors.accent, fontSize: 20 }}>{item.symbol}</Text>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700' }}>
                  {item.title}
                </Text>
                <Label muted style={{ fontSize: 13, lineHeight: 19 }}>
                  {item.detail}
                </Label>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
