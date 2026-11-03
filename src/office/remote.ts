import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';

/** What an office screen says when loading failed; offline means there was no connection. */
export function describeError(e: unknown): { error: string; offline: boolean } {
  if (e instanceof ApiRequestError) {
    if (e.error.statusCode === 0)
      return { error: t('No connection. Try again when you have signal.'), offline: true };
    return { error: t(e.error.message), offline: false };
  }
  return { error: t('Something went wrong'), offline: false };
}

export interface Remote<T> {
  data: T | null;
  error: string | null;
  offline: boolean;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads something for an office screen. Office screens need a connection: without one they show the error and a
 * Retry button (reload). The last data stays while reloading.
 */
export function useRemote<T>(load: (token: string) => Promise<T>, deps: unknown[]): Remote<T> {
  const { accessToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ error: string; offline: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const value = await load(await accessToken());
        if (!alive) return;
        setData(value);
        setError(null);
      } catch (e) {
        if (alive) setError(describeError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // The caller lists what the request depends on.
  }, [accessToken, round, ...deps]);

  return { data, error: error?.error ?? null, offline: error?.offline ?? false, loading, reload };
}
