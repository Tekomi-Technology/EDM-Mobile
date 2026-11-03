import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { decideLayout, SAVED_ROLES_KEY, type Layout } from './roles';
import type { CurrentUser } from './types';

function parseRoles(raw: string | null): string[] | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? value.filter((r): r is string => typeof r === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * The screens for the person signed in: decided at once from the roles saved on the phone, then from /me.
 * `layout` is null (a spinner) while nothing is known yet: see decideLayout.
 */
export function useLayout(): { layout: Layout | null; me: CurrentUser | null } {
  const auth = useAuth();
  const [saved, setSaved] = useState<string[] | null | undefined>(undefined);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SAVED_ROLES_KEY)
      .then(parseRoles, () => null)
      .then(setSaved);
  }, []);

  const { accessToken, signedIn } = auth;
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    (async () => {
      try {
        const current = await api<CurrentUser>(await accessToken(), '/me');
        if (!alive) return;
        setMe(current);
        await SecureStore.setItemAsync(SAVED_ROLES_KEY, JSON.stringify(current.roles));
      } catch {
        // No signal: keep the saved roles.
      } finally {
        if (alive) setSettled(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [accessToken, signedIn]);

  return { layout: decideLayout(saved, me?.roles ?? null, settled), me };
}

/** Forgets the saved roles, when the person signs out. */
export async function clearSavedRoles(): Promise<void> {
  await SecureStore.deleteItemAsync(SAVED_ROLES_KEY).catch(() => undefined);
}
