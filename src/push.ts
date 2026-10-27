import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show job notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

/**
 * Asks for permission and returns this phone's Expo push token, or null when push is not possible here
 * (emulator, permission refused, or no EAS project id configured; staff then get SMS instead).
 */
export async function pushToken(): Promise<{ token: string; platform: 'android' | 'ios' } | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    // Must match channelId in the API's push messages.
    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Jobs',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250]
    });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    console.warn('Push notifications are off: set EXPO_PUBLIC_EAS_PROJECT_ID (see .env.example).');
    return null;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
}

/** Calls onOpen with the job id when the person taps a job notification (also when it started the app). */
export function onNotificationTap(onOpen: (ticketId: string) => void): () => void {
  const open = (r: Notifications.NotificationResponse | null) => {
    const ticketId = r?.notification.request.content.data?.ticketId;
    if (typeof ticketId === 'string') onOpen(ticketId);
  };
  void Notifications.getLastNotificationResponseAsync().then(open);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}

/** Calls onJob when a job notification arrives while the app is open, to refresh the list. */
export function onNotificationReceived(onJob: () => void): () => void {
  const sub = Notifications.addNotificationReceivedListener(() => onJob());
  return () => sub.remove();
}
