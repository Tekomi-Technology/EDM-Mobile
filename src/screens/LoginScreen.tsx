import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { EDM_LOGO } from '../assets';
import { signInMessage, useAuth } from '../auth';
import { colors } from '../config';
import { Button, ErrorText, Icon, styles } from '../ui';
import { t } from '../i18n';
import { LanguagePicker } from './LanguagePicker';

const field = { ...styles.input, minHeight: 50, textAlignVertical: 'center' as const };

function Field({
  label,
  value,
  onChange,
  secret,
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  autoComplete: 'username' | 'password' | 'new-password';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.body, { fontWeight: '500' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={field}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function Frame({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.screen,
          { padding: 24, paddingTop: 56, gap: 20, backgroundColor: colors.surface }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Image
            source={EDM_LOGO}
            style={{ width: 160, height: 142 }}
            resizeMode="contain"
            accessibilityLabel={t('Electricidade de Moçambique, E.P.')}
          />
          <Text style={[styles.title, { fontSize: 30 }]}>EDM Field</Text>
          <Text style={[styles.label, { fontSize: 16, textAlign: 'center' }]}>{subtitle}</Text>
          <LanguagePicker />
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** M01: the app's front door; staff sign in with the account their manager gave them. */
export function LoginScreen() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(username, password);
    } catch (err) {
      setError(signInMessage(err));
      setBusy(false);
    }
  };

  return (
    <Frame subtitle={t('Your technical jobs, on your phone')}>
      <Field label={t('Username')} value={username} onChange={setUsername} autoComplete="username" />
      <Field label={t('Password')} value={password} onChange={setPassword} secret autoComplete="password" />
      <ErrorText message={error} />
      <Button
        label={t('Sign in')}
        onPress={() => void submit()}
        busy={busy}
        disabled={!auth.ready || !username.trim() || !password}
      />
      <Text style={{ textAlign: 'center', color: colors.brandText, fontWeight: '700', fontSize: 15 }}>
        {t('Forgot password? Ask your team manager')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          backgroundColor: colors.brandSoft,
          borderRadius: 14,
          padding: 16,
          marginTop: 12
        }}
      >
        <Icon name="info" color={colors.brandText} />
        <Text style={{ flex: 1, color: '#4A2C0A', fontSize: 15, lineHeight: 22 }}>
          {t('Works without internet. Your jobs are kept on the phone and sent when you are back online.')}
        </Text>
      </View>
    </Frame>
  );
}

/** After signing in with a temporary password: the person chooses their own before anything else. */
export function ChangePasswordScreen() {
  const auth = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next !== again) {
      setError(t('The two new passwords are not the same.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.changePassword(current, next);
    } catch (err) {
      setError(signInMessage(err));
      setBusy(false);
    }
  };

  return (
    <Frame subtitle={t('You signed in with a temporary password. Choose your own before you continue.')}>
      <Field
        label={t('Temporary password')}
        value={current}
        onChange={setCurrent}
        secret
        autoComplete="password"
      />
      <Field label={t('New password')} value={next} onChange={setNext} secret autoComplete="new-password" />
      <Field
        label={t('New password again')}
        value={again}
        onChange={setAgain}
        secret
        autoComplete="new-password"
      />
      <Text style={styles.label}>{t('Use letters and digits, and not your username.')}</Text>
      <ErrorText message={error} />
      <Button
        label={t('Save and continue')}
        onPress={() => void submit()}
        busy={busy}
        disabled={!current || !next || !again}
      />
      <Button label={t('Sign out')} kind="secondary" onPress={() => void auth.signOut()} />
    </Frame>
  );
}
