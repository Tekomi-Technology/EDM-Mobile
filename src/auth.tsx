import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { ApiRequestError } from './api';
import { API_URL } from './config';
import type { ApiError } from './types';

const STORE_KEY = 'edm.session';

/** What the phone keeps between launches: the session's renewal token lasts a month (Settings in the web app). */
interface Session {
  accessToken: string;
  /** Milliseconds since 1970. */
  expiresAt: number;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface SignInAnswer {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  mustChangePassword: boolean;
}

const sessionEnded = () =>
  new ApiRequestError({
    statusCode: 401,
    code: 'SESSION_ENDED',
    message: 'Your session has ended. Please sign in again.'
  });
const offline = () =>
  new ApiRequestError({
    statusCode: 0,
    code: 'OFFLINE',
    message: 'No connection. Your work is saved on the phone and will be sent later.'
  });

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  try {
    return await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
  } catch {
    throw offline();
  }
}

async function refused(res: Response): Promise<ApiRequestError> {
  const data = (await res.json().catch(() => null)) as ApiError | null;
  return new ApiRequestError(
    data ?? { statusCode: res.status, code: 'ERROR', message: 'The server did not answer' }
  );
}

/** The API's refusal in plain words for the sign-in screen. */
export function signInMessage(err: unknown): string {
  if (!(err instanceof ApiRequestError)) return 'Something went wrong. Please try again.';
  const { code, details } = err.error as ApiError & {
    details?: { minutes?: number; reason?: string; minLength?: number };
  };
  if (code === 'OFFLINE') return 'No connection. Sign in once you have signal.';
  if (code === 'INVALID_CREDENTIALS') return 'Wrong username or password.';
  if (code === 'ACCOUNT_LOCKED' || code === 'TOO_MANY_ATTEMPTS')
    return `Too many wrong passwords. Try again in ${details?.minutes ?? 15} min.`;
  if (code === 'WRONG_PASSWORD') return 'The temporary password is wrong.';
  if (code === 'PASSWORD_NOT_CHANGED') return 'Choose a password different from the temporary one.';
  if (code === 'WEAK_PASSWORD') {
    if (details?.reason === 'too_short')
      return `The password needs at least ${details.minLength} characters.`;
    if (details?.reason === 'letters_and_digits') return 'The password needs letters and digits.';
    if (details?.reason === 'contains_username') return 'The password must not contain your username.';
  }
  return err.message;
}

interface AuthState {
  ready: boolean;
  signedIn: boolean;
  /** Signed in with a temporary password: the person chooses their own first. */
  mustChangePassword: boolean;
  /** Throws an ApiRequestError when refused (see signInMessage). */
  signIn: (username: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * A valid access token, renewed when close to expiry. Throws an OFFLINE error (statusCode 0) without signing
   * out when the phone has no connection; signs out only when the server says the session is over.
   */
  accessToken: () => Promise<string>;
  /** Runs before the session is cleared on sign-out (e.g. to stop push notifications for this phone). */
  setBeforeSignOut: (fn: (() => Promise<void>) | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const fromAnswer = (a: SignInAnswer): Session => ({
  accessToken: a.accessToken,
  expiresAt: Date.now() + a.expiresIn * 1000,
  refreshToken: a.refreshToken,
  mustChangePassword: a.mustChangePassword
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useRef<Session | null>(null);
  const renewing = useRef<Promise<string> | null>(null);
  const beforeSignOut = useRef<(() => Promise<void>) | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [ready, setReady] = useState(false);

  const save = useCallback(async (s: Session | null) => {
    session.current = s;
    setSignedIn(!!s);
    setMustChangePassword(!!s?.mustChangePassword);
    if (s) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
    else await SecureStore.deleteItemAsync(STORE_KEY);
  }, []);

  // Restore the previous session so staff do not sign in every time they open the app.
  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          session.current = JSON.parse(raw) as Session;
          setSignedIn(true);
          setMustChangePassword(session.current.mustChangePassword);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const renew = useCallback(async (): Promise<string> => {
    const current = session.current;
    if (!current) throw sessionEnded();
    const res = await post('refresh', { refreshToken: current.refreshToken });
    if (res.status === 401) {
      await save(null);
      throw sessionEnded();
    }
    if (!res.ok) throw offline();
    const next = fromAnswer((await res.json()) as SignInAnswer);
    await save(next);
    return next.accessToken;
  }, [save]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      signedIn,
      mustChangePassword,
      signIn: async (username, password) => {
        const res = await post('sign-in', { username: username.trim(), password, client: 'app' });
        if (!res.ok) throw await refused(res);
        await save(fromAnswer((await res.json()) as SignInAnswer));
      },
      changePassword: async (currentPassword, newPassword) => {
        const current = session.current;
        if (!current) throw sessionEnded();
        const token = current.expiresAt - Date.now() > 30_000 ? current.accessToken : await renew();
        const res = await post('change-password', { currentPassword, newPassword }, token);
        if (!res.ok) throw await refused(res);
        await save({ ...session.current!, mustChangePassword: false });
      },
      signOut: async () => {
        await beforeSignOut.current?.().catch(() => undefined);
        const current = session.current;
        if (current) await post('sign-out', { refreshToken: current.refreshToken }).catch(() => undefined);
        await save(null);
      },
      setBeforeSignOut: (fn) => {
        beforeSignOut.current = fn;
      },
      accessToken: async () => {
        const current = session.current;
        if (!current) throw sessionEnded();
        if (current.expiresAt - Date.now() > 30_000) return current.accessToken;
        // One renewal at a time: the renewal token changes each time it is used.
        renewing.current ??= renew().finally(() => {
          renewing.current = null;
        });
        return renewing.current;
      }
    }),
    [ready, signedIn, mustChangePassword, save, renew]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
