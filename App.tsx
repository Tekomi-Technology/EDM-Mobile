import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/config';
import { useLanguage } from './src/i18n';
import { OfflineProvider } from './src/offline/OfflineProvider';
import { onNotificationTap } from './src/push';
import { JobScreen } from './src/screens/JobScreen';
import { JobsScreen } from './src/screens/JobsScreen';
import { ChangePasswordScreen, LoginScreen } from './src/screens/LoginScreen';
import { MeScreen } from './src/screens/MeScreen';
import { OfficeApp } from './src/office/OfficeApp';
import { clearSavedRoles, useLayout } from './src/useLayout';
import { TabBar } from './src/ui';
import { useOffline } from './src/offline/OfflineProvider';

function SignedIn() {
  const offline = useOffline();
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [tab, setTab] = useState<'jobs' | 'me'>('jobs');
  // Tapping a job notification opens that job.
  useEffect(() => onNotificationTap(setOpenJob), []);

  if (openJob) return <JobScreen id={openJob} onBack={() => setOpenJob(null)} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {tab === 'jobs' ? <JobsScreen onOpen={setOpenJob} /> : <MeScreen />}
      <TabBar current={tab} onChange={setTab} badge={offline.queue.length} />
    </View>
  );
}

/** Field staff: the app as it has always been (jobs kept on the phone, location while on duty). */
function FieldApp() {
  return (
    <OfflineProvider>
      <SignedIn />
    </OfflineProvider>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

/** Field staff get the field app; team managers, supervisors and administrators the office screens. */
function ChosenScreens() {
  const { layout } = useLayout();
  if (!layout) return <Loading />;
  return layout === 'field' ? <FieldApp /> : <OfficeApp layout={layout} />;
}

function Screens() {
  const auth = useAuth();
  // Someone else may sign in next on this phone.
  useEffect(() => {
    if (auth.ready && !auth.signedIn) void clearSavedRoles();
  }, [auth.ready, auth.signedIn]);

  if (!auth.ready) return <Loading />;
  if (!auth.signedIn) return <LoginScreen />;
  if (auth.mustChangePassword) return <ChangePasswordScreen />;
  return <ChosenScreens />;
}

export default function App() {
  // Everything below renders again in the language chosen.
  useLanguage();
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Screens />
    </AuthProvider>
  );
}
