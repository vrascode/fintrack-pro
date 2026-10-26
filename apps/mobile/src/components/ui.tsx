import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function Label({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const colors = useTheme();
  return (
    <Text style={{ color: muted ? colors.muted : colors.ink, fontSize: 16, lineHeight: 25 }}>
      {children}
    </Text>
  );
}
export function Card({ children }: PropsWithChildren) {
  const colors = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 24,
        padding: 24,
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  selected,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  secondary?: boolean;
  selected?: boolean;
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { checked: selected }) }}
      aria-disabled={disabled}
      {...(selected === undefined ? {} : { 'aria-checked': selected })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: secondary ? colors.tint : colors.accent,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text
        style={{
          color: secondary ? colors.accent : colors.mode === 'dark' ? '#102A22' : '#FFFFFF',
          fontWeight: '700',
          fontSize: 15,
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
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={{
          color: colors.ink,
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
          borderWidth: 1,
          borderRadius: 12,
          minHeight: 48,
          padding: 12,
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function Loading({ label = 'Carregando preferências…' }: { label?: string }) {
  const colors = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ padding: 32, alignItems: 'center', gap: 16 }}
    >
      <ActivityIndicator color={colors.accent} />
      <Label>{label}</Label>
    </View>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const colors = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <Text
        accessibilityRole="alert"
        style={{ color: colors.danger, fontSize: 16, lineHeight: 24 }}
      >
        {message}
      </Text>
      {retry ? <Button label="Tentar novamente" onPress={retry} secondary /> : null}
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
    <Card>
      <View
        style={{
          backgroundColor: colors.tint,
          borderRadius: 20,
          width: 64,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ color: colors.accent, fontSize: 30 }}
        >
          {symbol}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontSize: 23, fontWeight: '600' }}
      >
        {title}
      </Text>
      <Label muted>{description}</Label>
    </Card>
  );
}
export function Screen({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const colors = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 }}
      >
        <View style={{ width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{ color: colors.accent, fontSize: 16, fontWeight: '800', letterSpacing: 1 }}
            >
              fintrack <Text style={{ fontWeight: '400' }}>pro</Text>
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>SUA VIDA, EM EQUILÍBRIO</Text>
          </View>
          <View style={{ gap: 10, paddingTop: 16 }}>
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 36, fontWeight: '700', letterSpacing: -1 }}
            >
              {title}
            </Text>
            <Label muted>{subtitle}</Label>
          </View>
          {children}
          <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 12 }}>
            FinTrack Pro · Organização financeira pessoal
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
