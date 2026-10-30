import { useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { designTokens, useTheme } from '../theme';

export function Label({
  children,
  muted = false,
  style,
}: PropsWithChildren<{ muted?: boolean; style?: TextStyle }>) {
  const colors = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? colors.muted : colors.ink,
          fontFamily: designTokens.typography.family,
          fontSize: designTokens.typography.sizes.md,
          lineHeight: 24,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  accent = false,
  style,
}: PropsWithChildren<{ accent?: boolean; style?: ViewStyle }>) {
  const colors = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: accent ? colors.accent : colors.border,
          borderWidth: 1,
          borderRadius: designTokens.radius.lg,
          padding: designTokens.spacing.xl,
          gap: designTokens.spacing.lg,
          shadowColor: colors.shadow,
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  selected,
  compact = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  selected?: boolean;
  compact?: boolean;
}) {
  const colors = useTheme();
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  const quiet = variant === 'quiet';
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { checked: selected }) }}
      aria-disabled={disabled}
      {...(selected === undefined ? {} : { 'aria-checked': selected })}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: compact ? 42 : 48,
        minWidth: compact ? 42 : undefined,
        paddingHorizontal: compact ? 14 : 20,
        paddingVertical: compact ? 9 : 12,
        borderRadius: designTokens.radius.md,
        borderWidth: focused ? 2 : selected ? 1 : 0,
        borderColor: focused || selected ? colors.accent : 'transparent',
        backgroundColor: primary
          ? colors.accent
          : quiet
            ? 'transparent'
            : selected
              ? colors.accentSoft
              : colors.elevated,
        opacity: disabled ? 0.52 : pressed ? 0.76 : 1,
        transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text
        style={{
          color: primary ? colors.accentInk : selected ? colors.accentText : colors.ink,
          fontFamily: designTokens.typography.family,
          fontWeight: '700',
          fontSize: compact ? 14 : 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const colors = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: designTokens.spacing.sm }}>
      <Label>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
            borderWidth: focused ? 2 : 1,
            borderRadius: designTokens.radius.md,
            minHeight: 50,
            padding: 13,
            fontFamily: designTokens.typography.family,
          },
          props.style,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 20 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const colors = useTheme();
  const { t } = useI18n();
  const message = label ?? t('common.loading');
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={{ padding: designTokens.spacing.xxl, alignItems: 'center', gap: 14 }}
    >
      <ActivityIndicator color={colors.accent} />
      <Label>{message}</Label>
    </View>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const colors = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: designTokens.spacing.lg }}>
      <Text
        accessibilityRole="alert"
        style={{ color: colors.danger, fontSize: 15, lineHeight: 23 }}
      >
        {message}
      </Text>
      {retry ? <Button label={t('common.retry')} onPress={retry} variant="secondary" /> : null}
    </View>
  );
}

export function EmptyState({
  symbol,
  title,
  description,
}: {
  symbol: string;
  title: string;
  description: string;
}) {
  const colors = useTheme();
  return (
    <View style={{ gap: designTokens.spacing.lg, maxWidth: 620 }}>
      <View
        style={{
          backgroundColor: colors.accentSoft,
          borderRadius: designTokens.radius.md,
          width: 54,
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ color: colors.accentText, fontSize: 24, fontWeight: '700' }}
        >
          {symbol}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.ink,
          fontSize: 23,
          lineHeight: 30,
          fontWeight: '700',
          fontFamily: designTokens.typography.family,
        }}
      >
        {title}
      </Text>
      <Label muted>{description}</Label>
    </View>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  const colors = useTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.ink,
          fontSize: 18,
          fontWeight: '700',
          fontFamily: designTokens.typography.family,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Label muted style={{ fontSize: 14 }}>
          {detail}
        </Label>
      ) : null}
    </View>
  );
}

export function NegativeGradientBar({
  width = '100%',
  height = 8,
  radius = 5,
  accessibilityLabel,
}: {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  accessibilityLabel?: string;
}) {
  const colors = useTheme();
  const stops = [
    colors.negativeBright,
    colors.negativeStrong,
    colors.negativeDeep,
    colors.negativeDeepest,
  ];
  const segments = Array.from({ length: 12 }, (_, index) => {
    const position = (index / 11) * (stops.length - 1);
    const start = Math.floor(position);
    const end = Math.min(start + 1, stops.length - 1);
    const fraction = position - start;
    const startColor = stops[start] ?? colors.negativeBright;
    const endColor = stops[end] ?? colors.negativeDeepest;
    const channel = (hex: string, offset: number) =>
      Number.parseInt(hex.slice(offset, offset + 2), 16);
    const blend = (offset: number) =>
      Math.round(
        channel(startColor, offset) * (1 - fraction) + channel(endColor, offset) * fraction,
      )
        .toString(16)
        .padStart(2, '0');
    return `#${blend(1)}${blend(3)}${blend(5)}`;
  });

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {segments.map((color, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  eyebrow,
  children,
}: PropsWithChildren<{ title: string; subtitle: string; eyebrow?: string }>) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const horizontal = width >= designTokens.breakpoints.desktop ? 40 : width >= 700 ? 30 : 20;
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: horizontal, paddingVertical: 28 }}
      >
        <View style={{ width: '100%', maxWidth: 1280, alignSelf: 'center', gap: 28 }}>
          <View style={{ gap: 8, maxWidth: 820 }}>
            {eyebrow ? (
              <Text
                style={{
                  color: colors.accentText,
                  fontSize: 11,
                  letterSpacing: 1.8,
                  fontWeight: '800',
                  fontFamily: designTokens.typography.family,
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text
              accessibilityRole="header"
              style={{
                color: colors.ink,
                fontSize: width < 400 ? 30 : 36,
                lineHeight: width < 400 ? 38 : 44,
                fontWeight: '700',
                letterSpacing: -1.2,
                fontFamily: designTokens.typography.family,
              }}
            >
              {title}
            </Text>
            <Label muted style={{ fontSize: 16, maxWidth: 720 }}>
              {subtitle}
            </Label>
          </View>
          {children}
          <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 8 }}>
            FinTrack Pro · {t('common.footer')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
