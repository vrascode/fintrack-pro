import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Animated, Platform, Text, View, type TextInputInstance } from 'react-native';
import { useAuth } from '../src/auth';
import { useDemo } from '../src/demo';
import { Button, Field, Label, StatusMessage } from '../src/components/ui';
import { useI18n } from '../src/i18n';
import { designTokens, useTheme } from '../src/theme';
import { usePreferences } from '../src/preferences';
import { emailSchema, passwordSchema } from '@fintrack/shared';
import { AuthLayout } from '../src/auth/layout';
import { PasswordField } from '../src/auth/PasswordField';
import { useReducedMotion } from '../src/auth/useReducedMotion';

export default function LoginScreen() {
  const { language } = useI18n();
  const { value: preferences, update } = usePreferences();
  const colors = useTheme();
  const { signIn, register, error } = useAuth();
  const enterDemo = useDemo().enterDemo;
  const exitDemo = useDemo().exitDemo;
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmationRef = useRef<TextInputInstance>(null);
  const [attempted, setAttempted] = useState(false);
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
    emailSchema.safeParse(normalizedEmail).success &&
    passwordSchema.safeParse(password).success &&
    (!isRegistering || password === confirmation);

  async function submit() {
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmationTouched(true);
    if (!valid || submitting.current) return;
    submitting.current = true;
    setAttempted(true);
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
    error === 'configuration'
      ? text(
          'A configuração de acesso ao servidor é inválida.',
          'The server connection configuration is invalid.',
        )
      : error === 'origin'
        ? text(
            'O servidor não autorizou o acesso deste aplicativo.',
            'The server did not authorize access from this app.',
          )
        : error === 'server'
          ? text(
              'O servidor não conseguiu concluir a solicitação. Tente novamente.',
              'The server could not complete the request. Try again.',
            )
          : error === 'unavailable'
            ? text(
                'O servidor está acessível, mas o banco de dados está indisponível. Tente novamente após a configuração do servidor.',
                'The server is reachable, but the database is unavailable. Try again after server setup.',
              )
            : error === 'rate'
              ? text(
                  'Muitas tentativas. Aguarde um minuto e tente novamente.',
                  'Too many attempts. Wait a minute and try again.',
                )
              : error === 'credentials'
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
    <AuthLayout
      controls={
        <>
          {(['system', 'light', 'dark'] as const).map((theme, index) => (
            <Button
              key={theme}
              compact
              variant="quiet"
              selected={preferences.theme === theme}
              label={
                [text('Automático', 'Automatic'), text('Claro', 'Light'), text('Escuro', 'Dark')][
                  index
                ]!
              }
              disabled={busy}
              onPress={() => void update({ theme })}
            />
          ))}
          <Button
            compact
            variant="quiet"
            disabled={busy}
            label={language === 'pt-BR' ? 'English' : 'Português (Brasil)'}
            onPress={() => void update({ language: language === 'pt-BR' ? 'en' : 'pt-BR' })}
          />
        </>
      }
    >
      <Animated.View testID="auth-form-content" style={{ opacity, gap: 24 }}>
        <View style={{ gap: 10 }}>
          <Text
            style={{
              color: colors.accentText,
              fontFamily: designTokens.typography.family,
              fontSize: 11,
              letterSpacing: 2,
              fontWeight: '800',
            }}
          >
            {text('SEU PRÓXIMO PASSO', 'YOUR NEXT STEP')}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.ink,
              fontFamily: designTokens.typography.family,
              fontSize: 30,
              lineHeight: 37,
              letterSpacing: -0.8,
              fontWeight: '800',
            }}
          >
            {isRegistering
              ? text('Crie espaço para seus planos.', 'Make room for your plans.')
              : text('Bem-vindo de volta', 'Welcome back')}
          </Text>
          <Label muted>
            {isRegistering
              ? text(
                  'Crie sua conta e comece a organizar seu dinheiro.',
                  'Create your account and start organizing your money.',
                )
              : text(
                  'Entre para continuar de onde parou.',
                  'Sign in and pick up where you left off.',
                )}
          </Label>
        </View>
        {attempted && errorMessage ? <StatusMessage message={errorMessage} tone="error" /> : null}
        <View style={{ gap: 20 }}>
          <Field
            label={text('E-mail', 'Email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onBlur={() => setEmailTouched(true)}
            {...(emailError ? { error: emailError } : {})}
          />
          <PasswordField
            label={text('Senha', 'Password')}
            value={password}
            onChangeText={setPassword}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
            inputRef={passwordRef}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            textContentType={isRegistering ? 'newPassword' : 'password'}
            editable={!busy}
            returnKeyType={isRegistering ? 'next' : 'go'}
            onSubmitEditing={() =>
              isRegistering ? confirmationRef.current?.focus() : void submit()
            }
            onBlur={() => setPasswordTouched(true)}
            {...(isRegistering
              ? {
                  hint: text(
                    'De 15 a 128 caracteres. Use uma frase que só você conheça.',
                    '15–128 characters. Use a phrase only you know.',
                  ),
                }
              : {})}
            {...(passwordError ? { error: passwordError } : {})}
          />
          {isRegistering ? (
            <Field
              label={text('Confirmar senha', 'Confirm password')}
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry={!passwordVisible}
              inputRef={confirmationRef}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!busy}
              returnKeyType="go"
              onBlur={() => setConfirmationTouched(true)}
              onSubmitEditing={() => void submit()}
              {...(confirmationTouched && confirmation !== password
                ? { error: text('As senhas precisam ser iguais.', 'Passwords must match.') }
                : {})}
            />
          ) : null}
        </View>
        <Button
          label={
            busy
              ? text('Conectando…', 'Connecting…')
              : isRegistering
                ? text('Criar minha conta', 'Create my account')
                : text('Entrar', 'Sign in')
          }
          disabled={busy || !valid}
          loading={busy}
          onPress={() => void submit()}
        />
        <View style={{ gap: 8 }}>
          <Label muted style={{ fontSize: 14, textAlign: 'center' }}>
            {isRegistering
              ? text('Já tem uma conta?', 'Already have an account?')
              : text('Ainda não tem conta?', 'New to FinTrack Pro?')}
          </Label>
          <Button
            variant="quiet"
            disabled={busy}
            label={
              isRegistering
                ? text('Entrar na minha conta', 'Sign in to my account')
                : text('Começar com meus dados', 'Start with my own data')
            }
            onPress={() => {
              setIsRegistering((value) => !value);
              setConfirmation('');
              setConfirmationTouched(false);
              setAttempted(false);
              opacity.stopAnimation();
              if (reducedMotion) {
                opacity.setValue(1);
              } else {
                opacity.setValue(0.7);
                Animated.timing(opacity, {
                  toValue: 1,
                  duration: 160,
                  useNativeDriver: Platform.OS !== 'web',
                }).start();
              }
            }}
          />
        </View>
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 4 }}>
          <Button
            variant="quiet"
            disabled={busy}
            label={text('Explorar demonstração · dados fictícios', 'Explore demo · fictional data')}
            onPress={() => void exploreDemo()}
          />
        </View>
      </Animated.View>
    </AuthLayout>
  );
}
