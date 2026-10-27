import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  TokenError,
  TokenResponse,
  useAuthRequest,
  type DiscoveryDocument
} from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
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
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER } from './config';

WebBrowser.maybeCompleteAuthSession();

const STORE_KEY = 'edm.tokens';

/**
 * Keycloak's addresses, written out instead of fetched, so the app opens and refreshes tokens without first
 * having to reach the server (staff often start the day with no signal).
 */
const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
  tokenEndpoint: `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
  revocationEndpoint: `${KEYCLOAK_ISSUER}/protocol/openid-connect/revoke`,
  endSessionEndpoint: `${KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
};

const sessionEnded = () =>
  new ApiRequestError({
    statusCode: 401,
    code: 'SESSION_ENDED',
    message: 'Your session has ended. Please sign in again.'
  });

interface AuthState {
  ready: boolean;
  signedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * A valid access token, refreshed when close to expiry. Throws an OFFLINE error (statusCode 0) without signing
   * out when the phone has no connection; signs out only when Keycloak says the session is over.
   */
  accessToken: () => Promise<string>;
  /** Runs before the tokens are cleared on sign-out (e.g. to stop push notifications for this phone). */
  setBeforeSignOut: (fn: (() => Promise<void>) | null) => void;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const redirectUri = makeRedirectUri({ scheme: 'edm', path: 'auth' });
  // offline_access gives a refresh token that outlives the 8-hour web session, so a whole shift without
  // signal does not sign the person out.
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: KEYCLOAK_CLIENT_ID,
      scopes: ['openid', 'profile', 'offline_access'],
      redirectUri,
      usePKCE: true
    },
    discovery
  );
  const tokens = useRef<TokenResponse | null>(null);
  const beforeSignOut = useRef<(() => Promise<void>) | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (t: TokenResponse | null) => {
    tokens.current = t;
    setSignedIn(!!t);
    if (t) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(t.getRequestConfig()));
    else await SecureStore.deleteItemAsync(STORE_KEY);
  }, []);

  // Restore the previous session so staff do not sign in every time they open the app.
  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          tokens.current = new TokenResponse(JSON.parse(raw));
          setSignedIn(true);
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    exchangeCodeAsync(
      {
        clientId: KEYCLOAK_CLIENT_ID,
        code: response.params.code!,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier }
      },
      discovery
    )
      .then(save)
      .catch((e: Error) => setError(e.message));
  }, [response, request, redirectUri, save]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      signedIn,
      error,
      signIn: async () => {
        setError(null);
        await promptAsync();
      },
      signOut: async () => {
        await beforeSignOut.current?.().catch(() => undefined);
        await save(null);
      },
      setBeforeSignOut: (fn) => {
        beforeSignOut.current = fn;
      },
      accessToken: async () => {
        const current = tokens.current;
        if (!current) throw sessionEnded();
        if (!current.shouldRefresh()) return current.accessToken;
        if (!current.refreshToken) {
          await save(null);
          throw sessionEnded();
        }
        try {
          const refreshed = await refreshAsync(
            { clientId: KEYCLOAK_CLIENT_ID, refreshToken: current.refreshToken },
            discovery
          );
          // Keycloak may not send a new refresh token every time; keep the old one then.
          if (!refreshed.refreshToken) refreshed.refreshToken = current.refreshToken;
          await save(refreshed);
          return refreshed.accessToken;
        } catch (e) {
          if (e instanceof TokenError) {
            await save(null);
            throw sessionEnded();
          }
          throw new ApiRequestError({
            statusCode: 0,
            code: 'OFFLINE',
            message: 'No connection. Your work is saved on the phone and will be sent later.'
          });
        }
      }
    }),
    [ready, signedIn, error, promptAsync, save]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
