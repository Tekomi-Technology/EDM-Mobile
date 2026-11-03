import { clearLocations, stopTracking } from '../location';

/**
 * Office screens never share the location. Someone who was field staff (e.g. just made team manager) may still
 * have the location task running from the field app: stop it and forget the positions not sent.
 */
export async function leaveFieldMode(): Promise<void> {
  await stopTracking().catch(() => undefined);
  await clearLocations().catch(() => undefined);
}
