import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { API_URL } from './config';
import { appendPoints, uploadPoints, type QueuedPoint } from './offline/locations';
import { readJson, writeJson } from './offline/storage';

/** Background task name; defined at import time, as the operating system may start the app just to run it. */
const TASK = 'edm-location';
const QUEUE_FILE = 'locations';
const TOKENS_KEY = 'edm.tokens';

export type LocationStatus = 'on' | 'off' | 'denied';

/** The access token saved by auth.tsx, if still valid for a minute; background code cannot refresh it. */
async function storedToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as { accessToken: string; issuedAt?: number; expiresIn?: number };
    if (t.issuedAt && t.expiresIn && t.issuedAt + t.expiresIn - 60 < Date.now() / 1000) return null;
    return t.accessToken;
  } catch {
    return null;
  }
}

/** Sends waiting positions with the given token; keeps whatever could not be sent. */
export async function flushLocations(token: string | null = null): Promise<void> {
  const queue = (await readJson<QueuedPoint[]>(QUEUE_FILE)) ?? [];
  if (queue.length === 0) return;
  const bearer = token ?? (await storedToken());
  if (!bearer) return;
  const remaining = await uploadPoints(queue, async (points) => {
    const res = await fetch(`${API_URL}/me/locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
      signal: AbortSignal.timeout(20_000)
    });
    // 4xx other than an expired session means the points will never be accepted: drop them.
    if (!res.ok && (res.status >= 500 || res.status === 401)) throw new Error(`HTTP ${res.status}`);
  });
  await writeJson(QUEUE_FILE, remaining);
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const points: QueuedPoint[] = data.locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracy: l.coords.accuracy ?? undefined,
    recordedAt: new Date(l.timestamp).toISOString()
  }));
  const queue = (await readJson<QueuedPoint[]>(QUEUE_FILE)) ?? [];
  await writeJson(QUEUE_FILE, appendPoints(queue, points));
  await flushLocations().catch(() => undefined);
});

/**
 * "All the time" is asked for once per run of the app: Android answers each request with a dialog or its settings
 * screen, which takes the person out of the app, and coming back refreshes the jobs. Asking every time would loop.
 */
let askedForBackground = false;

/**
 * Starts sharing the position while on duty, also with the screen off (asks for "allow all the time").
 * Android shows a permanent notification while it runs, so staff always know. Permissions already given are not
 * asked for again; `askAgain` (the person tapping "Allow location") asks for "all the time" once more.
 */
export async function startTracking(askAgain = false): Promise<LocationStatus> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  if (askAgain || !askedForBackground) {
    askedForBackground = true;
    // Without "all the time" it still works while the app is open, so a refusal here is not fatal.
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (bg && !bg.granted && bg.canAskAgain) {
      await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
    }
  }
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) return 'on';
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 50,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'EDM Field',
      notificationBody: 'Sharing your location while you are on duty',
      notificationColor: '#F39B3A'
    }
  });
  return 'on';
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}

export async function trackingStatus(): Promise<LocationStatus> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted && !fg.canAskAgain) return 'denied';
  return (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) ? 'on' : 'off';
}

/** Forgets positions not sent yet (signing out). */
export async function clearLocations(): Promise<void> {
  await writeJson(QUEUE_FILE, []);
}
