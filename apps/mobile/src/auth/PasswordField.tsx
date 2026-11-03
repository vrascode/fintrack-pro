import type { ComponentProps } from 'react';
import { Field, Button } from '../components/ui';
import { useI18n } from '../i18n';

export function PasswordField({
  visible,
  onToggle,
  ...props
}: Omit<ComponentProps<typeof Field>, 'secureTextEntry' | 'trailing'> & {
  visible: boolean;
  onToggle(): void;
}) {
  const { language } = useI18n();
  const label = visible
    ? language === 'pt-BR'
      ? 'Ocultar senha'
      : 'Hide password'
    : language === 'pt-BR'
      ? 'Mostrar senha'
      : 'Show password';
  const caption = visible
    ? language === 'pt-BR'
      ? 'Ocultar'
      : 'Hide'
    : language === 'pt-BR'
      ? 'Mostrar'
      : 'Show';
  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Button
          compact
          variant="quiet"
          disabled={props.editable === false}
          label={caption}
          accessibilityLabel={label}
          onPress={onToggle}
        />
      }
    />
  );
}
