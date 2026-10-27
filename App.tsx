import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/config';
import { OfflineProvider } from './src/offline/OfflineProvider';
import { onNotificationTap } from './src/push';
import { JobScreen } from './src/screens/JobScreen';
import { JobsScreen } from './src/screens/JobsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MeScreen } from './src/screens/MeScreen';
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

function Screens() {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (!auth.signedIn) return <LoginScreen />;
  return (
    <OfflineProvider>
      <SignedIn />
    </OfflineProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Screens />
    </AuthProvider>
  );
}
