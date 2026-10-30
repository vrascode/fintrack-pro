import { useState } from 'react';
import { router } from 'expo-router';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../src/auth';
import { useDemo } from '../src/demo';
import { Button, Card, Field, Label, Screen, StatusMessage } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { designTokens, useTheme } from '../src/theme';

export default function LoginScreen() {
  const { language } = useI18n();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const { signIn, register, error, status } = useAuth();
  const enterDemo = useDemo().enterDemo;
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const pt = language === 'pt-BR';
  const text = (portuguese: string, english: string) => (pt ? portuguese : english);
  const busy = status === 'loading';

  async function submit() {
    const input = { email, password };
    const success = isRegistering
      ? await register(input, `FinTrack Pro ${Platform.OS}`)
      : await signIn({ ...input, deviceName: `FinTrack Pro ${Platform.OS}` });
    if (success) router.replace('/(tabs)');
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
        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '800' }}>
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
        />
        <Field
          label={text('Senha', 'Password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          textContentType={isRegistering ? 'newPassword' : 'password'}
          editable={!busy}
          onSubmitEditing={() => void submit()}
        />
        {isRegistering ? (
          <Label muted style={{ fontSize: 13 }}>
            {text(
              'Use uma senha longa, com pelo menos 15 caracteres.',
              'Use a long password with at least 15 characters.',
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
          disabled={busy || !email.trim() || !password}
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
