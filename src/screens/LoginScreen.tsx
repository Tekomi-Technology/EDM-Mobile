import { Image, Text, View } from 'react-native';
import { EDM_LOGO } from '../assets';
import { useAuth } from '../auth';
import { colors } from '../config';
import { Button, ErrorText, Icon, styles } from '../ui';

/** M01: the app's front door. The username and password are typed on the EDM sign-in page that opens next. */
export function LoginScreen() {
  const auth = useAuth();
  return (
    <View style={[styles.screen, { padding: 24, paddingTop: 72, gap: 28, backgroundColor: colors.surface }]}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Image
          source={EDM_LOGO}
          style={{ width: 200, height: 178 }}
          resizeMode="contain"
          accessibilityLabel="Electricidade de Moçambique, E.P."
        />
        <Text style={[styles.title, { fontSize: 30 }]}>EDM Field</Text>
        <Text style={[styles.label, { fontSize: 16 }]}>Your technical jobs, on your phone</Text>
      </View>
      <ErrorText message={auth.error} />
      <Button label="Sign in" onPress={() => void auth.signIn()} disabled={!auth.ready} />
      <Text style={{ textAlign: 'center', color: colors.brandText, fontWeight: '700', fontSize: 15 }}>
        Forgot password? Ask your team manager
      </Text>
      <View style={{ flex: 1 }} />
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          backgroundColor: colors.brandSoft,
          borderRadius: 14,
          padding: 16,
          marginBottom: 24
        }}
      >
        <Icon name="info" color={colors.brandText} />
        <Text style={{ flex: 1, color: '#4A2C0A', fontSize: 15, lineHeight: 22 }}>
          Works without internet. Your jobs are kept on the phone and sent when you are back online.
        </Text>
      </View>
    </View>
  );
}
