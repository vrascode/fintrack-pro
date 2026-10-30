import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../src/auth';
import { useDemo } from '../src/demo';
import { Button, Card, Field, Label, Screen, StatusMessage } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { designTokens, useTheme } from '../src/theme';
import { emailSchema, passwordSchema } from '@fintrack/shared';

export default function LoginScreen() {
  const { language } = useI18n();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const { signIn, register, error } = useAuth();
  const enterDemo = useDemo().enterDemo;
  const exitDemo = useDemo().exitDemo;
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const pt = language === 'pt-BR';
  const text = (portuguese: string, english: string) => (pt ? portuguese : english);
  const normalizedEmail = email.trim();
  const emailError =
    emailTouched && !emailSchema.safeParse(normalizedEmail).success
      ? text('Informe um e-mail válido.', 'Enter a valid email address.')
      : null;
  const passwordError =
    passwordTouched && !passwordSchema.safeParse(password).success
      ? text(
          'A senha precisa ter de 15 a 128 caracteres válidos.',
          'Password must contain 15 to 128 valid characters.',
        )
      : null;
  const valid =
    emailSchema.safeParse(normalizedEmail).success && passwordSchema.safeParse(password).success;

  async function submit() {
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!valid || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const input = { email: normalizedEmail, password };
      const success = isRegistering
        ? await register(input, `FinTrack Pro ${Platform.OS}`)
        : await signIn({ ...input, deviceName: `FinTrack Pro ${Platform.OS}` });
      if (success) {
        await exitDemo();
        router.replace(isRegistering ? '/accounts' : '/(tabs)');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function exploreDemo() {
    await enterDemo();
    router.replace('/(tabs)');
  }

  const errorMessage =
    error === 'credentials'
      ? text('E-mail ou senha incorretos.', 'Email or password is incorrect.')
      : error === 'exists'
        ? text(
            'Já existe uma conta com este e-mail. Entre nela.',
            'An account already uses this email. Sign in instead.',
          )
        : error === 'invalid'
          ? text('Confira os dados informados.', 'Check the information you entered.')
          : error === 'network'
            ? text(
                'Não foi possível acessar a API. Confira a conexão e tente novamente.',
                'Could not reach the API. Check your connection and try again.',
              )
            : error === 'read'
              ? text(
                  'A sessão salva não pôde ser recuperada.',
                  'The saved session could not be restored.',
                )
              : null;

  return (
    <Screen
      eyebrow="FINTRACK PRO"
      title={text('Comece com seus dados', 'Start with your own data')}
      subtitle={text(
        'Crie sua conta para salvar suas contas financeiras e movimentações com segurança.',
        'Create an account to securely save your financial accounts and transactions.',
      )}
    >
      <Card
        accent
        style={{
          width: '100%',
          maxWidth: 540,
          alignSelf: 'center',
          padding: width < designTokens.breakpoints.tablet ? 20 : 32,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 21, fontWeight: '800' }}
        >
          {isRegistering ? text('Criar conta', 'Create account') : text('Entrar', 'Sign in')}
        </Text>
        <Label muted>
          {isRegistering
            ? text(
                'Você poderá continuar depois sem perder o que salvar.',
                'You can continue later without losing saved information.',
              )
            : text(
                'Entre para recuperar sua sessão e seus dados.',
                'Sign in to restore your session and data.',
              )}
        </Label>
        {errorMessage ? <StatusMessage message={errorMessage} tone="error" /> : null}
        <Field
          label={text('E-mail', 'Email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          onBlur={() => setEmailTouched(true)}
          {...(emailError ? { error: emailError } : {})}
        />
        <Field
          label={text('Senha', 'Password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!passwordVisible}
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          textContentType={isRegistering ? 'newPassword' : 'password'}
          editable={!busy}
          onSubmitEditing={() => void submit()}
          onBlur={() => setPasswordTouched(true)}
          {...(passwordError ? { error: passwordError } : {})}
        />
        <Button
          variant="quiet"
          disabled={busy}
          label={
            passwordVisible
              ? text('Ocultar senha', 'Hide password')
              : text('Mostrar senha', 'Show password')
          }
          onPress={() => setPasswordVisible((visible) => !visible)}
        />
        {isRegistering ? (
          <Label muted style={{ fontSize: 13 }}>
            {text(
              'A senha deve ter de 15 a 128 caracteres. Espaços e acentos são aceitos.',
              'Password must contain 15 to 128 characters. Spaces and Unicode are allowed.',
            )}
          </Label>
        ) : null}
        <Button
          label={
            busy
              ? text('Conectando…', 'Connecting…')
              : isRegistering
                ? text('Criar minha conta', 'Create my account')
                : text('Entrar', 'Sign in')
          }
          disabled={busy || !valid}
          onPress={() => void submit()}
        />
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Label muted>
            {isRegistering
              ? text('Já tem uma conta?', 'Already have an account?')
              : text('Ainda não tem conta?', 'New to FinTrack Pro?')}
          </Label>
          <Button
            variant="secondary"
            disabled={busy}
            label={
              isRegistering
                ? text('Entrar na minha conta', 'Sign in to my account')
                : text('Começar com meus dados', 'Start with my own data')
            }
            onPress={() => {
              setIsRegistering((value) => !value);
            }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Button
          variant="quiet"
          disabled={busy}
          label={text('Explorar demonstração · dados fictícios', 'Explore demo · fictional data')}
          onPress={() => void exploreDemo()}
        />
      </Card>
    </Screen>
  );
}
