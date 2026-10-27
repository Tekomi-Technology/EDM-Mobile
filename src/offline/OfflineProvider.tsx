import {
  OCCURRED_AT_HEADER,
  type CurrentUser,
  type HelpRequestInput,
  type HelpRequestView,
  type MaterialLine,
  type MyVan,
  type SurveyReport,
  type TicketDetail,
  type TicketSummary
} from '../types';
import { randomUUID } from 'expo-crypto';
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
import { AppState } from 'react-native';
import { api, ApiRequestError, uploadPhoto } from '../api';
import { useAuth } from '../auth';
import {
  clearLocations,
  flushLocations,
  startTracking,
  stopTracking,
  type LocationStatus
} from '../location';
import { onNotificationReceived, pushToken } from '../push';
import {
  applyPending,
  photosNoLongerNeeded,
  syncQueue,
  type Conflict,
  type QueuedAction,
  type QueuedPhoto,
  resolveBody
} from './engine';
import { clearAll, deletePhoto, keepPhoto, readJson, writeJson } from './storage';

/** What a screen asks for; the provider adds the id, job code and time. */
export type NewAction =
  | { kind: 'accept' | 'start' | 'resume'; ticketId: string }
  | { kind: 'decline' | 'hold'; ticketId: string; reason: string }
  | {
      kind: 'resolve';
      ticketId: string;
      note: string;
      photos: QueuedPhoto[];
      materials?: MaterialLine[];
      survey?: SurveyReport;
      installation?: {
        meterNumber: string;
        sealNumber?: string;
        handoverCode?: string;
        signedFormPhoto?: number;
      };
    };

interface Saved {
  me: CurrentUser | null;
  jobs: TicketSummary[];
  details: Record<string, TicketDetail>;
  /** Jobs reported done today, as the server last said. */
  doneToday: number;
  /** The van and its stock, for recording materials offline. */
  van?: MyVan | null;
  savedAt: string | null;
}

interface OfflineState {
  me: CurrentUser | null;
  /** My jobs as they will be once waiting changes are sent. */
  jobs: TicketSummary[];
  job: (id: string) => TicketDetail | null;
  /** Changes waiting to be sent, oldest first. */
  queue: QueuedAction[];
  conflicts: Conflict[];
  /** False after the last attempt to reach the server failed for lack of connection. */
  online: boolean;
  busy: boolean;
  /** Jobs done today, including those finished on the phone and not sent yet. */
  doneToday: number;
  /** When the saved jobs were last refreshed from the server. */
  savedAt: string | null;
  error: string | null;
  /** Sends waiting changes now (the Me tab's "Send now"). */
  sendNow: () => Promise<void>;
  /** Whether the position is being shared (only while on duty). */
  locationStatus: LocationStatus;
  enableLocation: () => Promise<void>;
  van: MyVan | null;
  /** Online only: texts the new customer a handover code. */
  sendHandoverCode: (ticketId: string) => Promise<void>;
  /** Online only: asks the back office for help. */
  askForHelp: (input: HelpRequestInput) => Promise<void>;
  helpRequests: () => Promise<HelpRequestView[]>;
  replyToHelp: (helpId: string, body: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshJob: (id: string) => Promise<void>;
  perform: (action: NewAction) => Promise<void>;
  keepPhoto: (uri: string) => string;
  setDuty: (onDuty: boolean) => Promise<void>;
  dismissConflict: (id: string) => void;
}

const OfflineContext = createContext<OfflineState | null>(null);
const RETRY_MS = 30_000;

const isOffline = (e: unknown) => e instanceof ApiRequestError && e.error.statusCode === 0;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/**
 * Keeps the person's jobs on the phone and queues what they do, so the app works without signal.
 * Everything is sent in order as soon as the server can be reached again.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [saved, setSaved] = useState<Saved>({ me: null, jobs: [], details: {}, doneToday: 0, savedAt: null });
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('off');

  // Refs so the sync loop always sees the latest values without re-creating callbacks.
  const queueRef = useRef<QueuedAction[]>([]);
  const savedRef = useRef(saved);
  const syncing = useRef(false);
  const pushRegistered = useRef<string | null>(null);
  savedRef.current = saved;

  const storeQueue = useCallback(async (q: QueuedAction[]) => {
    queueRef.current = q;
    setQueue(q);
    await writeJson('queue', q);
  }, []);

  const storeSaved = useCallback(async (s: Saved) => {
    setSaved(s);
    await writeJson('saved', s);
  }, []);

  // Load what was saved on the phone before anything else, so the app opens even with no signal.
  useEffect(() => {
    void (async () => {
      const [s, q, c] = await Promise.all([
        readJson<Saved>('saved'),
        readJson<QueuedAction[]>('queue'),
        readJson<Conflict[]>('conflicts')
      ]);
      if (s) setSaved(s);
      queueRef.current = q ?? [];
      setQueue(q ?? []);
      setConflicts(c ?? []);
      setLoaded(true);
    })();
  }, []);

  /** Sends waiting changes. Returns true when the queue is empty afterwards. */
  const sync = useCallback(async (): Promise<boolean> => {
    if (syncing.current) return false;
    if (queueRef.current.length === 0) return true;
    syncing.current = true;
    const before = queueRef.current;
    // Actions added while this sync runs are not in `before`; keep them at the end of whatever is saved.
    const withNewer = (remaining: QueuedAction[]) => [
      ...remaining,
      ...queueRef.current.filter((a) => !before.some((b) => b.id === a.id))
    ];
    let outcome: 'done' | 'offline' | 'error' = 'error';
    try {
      const result = await syncQueue(before, {
        myUserId: savedRef.current.me?.id ?? '',
        save: (remaining) => storeQueue(withNewer(remaining)),
        fetchTicket: async (id) => {
          try {
            const t = await api<TicketDetail>(await auth.accessToken(), `/tickets/${id}`);
            return { status: t.status, assigneeId: t.assignee?.id ?? null };
          } catch (e) {
            if (e instanceof ApiRequestError && e.error.statusCode === 404) return null;
            throw e;
          }
        },
        send: async (a, photoUploaded) => {
          const token = await auth.accessToken();
          const headers = { [OCCURRED_AT_HEADER]: a.occurredAt };
          if (a.kind === 'resolve') {
            const attachmentIds: string[] = [];
            for (const [i, p] of a.photos.entries()) {
              const id = p.attachmentId ?? (await uploadPhoto(token, a.ticketId, p.localUri, p.fileName));
              if (!p.attachmentId) await photoUploaded(i, id);
              attachmentIds.push(id);
            }
            await api(token, `/tickets/${a.ticketId}/resolve`, {
              method: 'POST',
              body: resolveBody(a, attachmentIds),
              headers
            });
          } else {
            await api(token, `/tickets/${a.ticketId}/${a.kind}`, {
              method: 'POST',
              body: 'reason' in a ? { reason: a.reason } : undefined,
              headers
            });
          }
        }
      });
      outcome = result.outcome;
      await storeQueue(withNewer(result.queue));
      for (const uri of photosNoLongerNeeded(before, result.queue)) deletePhoto(uri);
      if (result.conflicts.length) {
        setConflicts((c) => {
          const next = [...c, ...result.conflicts];
          void writeJson('conflicts', next);
          return next;
        });
      }
      setOnline(outcome !== 'offline');
      setError(outcome === 'error' ? (result.error ?? null) : null);
    } finally {
      syncing.current = false;
    }
    // Something was added while sending: send that too.
    if (outcome === 'done' && queueRef.current.length > 0) return sync();
    return queueRef.current.length === 0;
  }, [auth, storeQueue]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      // Send first, so what comes back already includes this person's changes.
      await sync();
      const token = await auth.accessToken();
      const [me, jobs, today, van] = await Promise.all([
        api<CurrentUser>(token, '/me'),
        api<TicketSummary[]>(token, '/me/jobs'),
        api<{ done: number }>(token, '/me/today'),
        api<MyVan>(token, '/me/van')
      ]);
      // Keep full details of every job, so customer, address and map work offline too.
      const details: Record<string, TicketDetail> = {};
      await Promise.all(
        jobs.map(async (j) => {
          details[j.id] = await api<TicketDetail>(token, `/tickets/${j.id}`);
        })
      );
      await storeSaved({ me, jobs, details, doneToday: today.done, van, savedAt: new Date().toISOString() });
      // Positions recorded while the app was closed or offline.
      await flushLocations(token).catch(() => undefined);
      setOnline(true);
      setError(null);
    } catch (e) {
      if (isOffline(e)) setOnline(false);
      else setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [auth, sync, storeSaved]);

  const refreshJob = useCallback(
    async (id: string) => {
      try {
        const detail = await api<TicketDetail>(await auth.accessToken(), `/tickets/${id}`);
        const s = savedRef.current;
        await storeSaved({ ...s, details: { ...s.details, [id]: detail } });
        setOnline(true);
      } catch (e) {
        if (isOffline(e)) setOnline(false);
        else if (!(e instanceof ApiRequestError && e.error.statusCode === 404)) setError(messageOf(e));
      }
    },
    [auth, storeSaved]
  );

  const perform = useCallback(
    async (input: NewAction) => {
      const s = savedRef.current;
      const code = s.details[input.ticketId]?.code ?? s.jobs.find((j) => j.id === input.ticketId)?.code ?? '';
      const action = {
        ...input,
        id: randomUUID(),
        ticketCode: code,
        occurredAt: new Date().toISOString()
      } as QueuedAction;
      await storeQueue([...queueRef.current, action]);
      if (await sync()) await refresh();
    },
    [storeQueue, sync, refresh]
  );

  const setDuty = useCallback(
    async (onDuty: boolean) => {
      try {
        const me = await api<CurrentUser>(await auth.accessToken(), '/me/duty', {
          method: 'POST',
          body: { onDuty }
        });
        await storeSaved({ ...savedRef.current, me });
        setError(null);
      } catch (e) {
        setError(
          isOffline(e) ? 'Switching duty needs a connection. Try again when you have signal.' : messageOf(e)
        );
      }
    },
    [auth, storeSaved]
  );

  const dismissConflict = useCallback((id: string) => {
    setConflicts((c) => {
      const next = c.filter((x) => x.id !== id);
      void writeJson('conflicts', next);
      return next;
    });
  }, []);

  // First load, and every time the app comes back to the screen.
  useEffect(() => {
    if (!loaded) return;
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [loaded, refresh]);

  // Keep trying while changes are waiting.
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setInterval(() => {
      void sync().then((empty) => {
        if (empty) void refresh();
      });
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [queue.length, sync, refresh]);

  // Share the position only while on duty: start when going on duty, stop when going off.
  const onDuty = saved.me?.onDuty ?? false;
  useEffect(() => {
    if (!loaded || !saved.me) return;
    if (onDuty) {
      startTracking()
        .then(setLocationStatus)
        .catch(() => setLocationStatus('off'));
    } else {
      void stopTracking().finally(() => setLocationStatus('off'));
    }
  }, [loaded, onDuty, saved.me]);

  const online_ = useCallback(
    async <T,>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => {
      try {
        return await api<T>(await auth.accessToken(), path, init);
      } catch (e) {
        if (isOffline(e)) throw new Error('This needs a connection. Try again when you have signal.');
        throw e;
      }
    },
    [auth]
  );
  const sendHandoverCode = useCallback(
    async (ticketId: string) => {
      await online_(`/tickets/${ticketId}/handover-code`, { method: 'POST' });
    },
    [online_]
  );
  const askForHelp = useCallback(
    async (input: HelpRequestInput) => {
      await online_('/help-requests', { method: 'POST', body: input });
    },
    [online_]
  );
  const helpRequests = useCallback(() => online_<HelpRequestView[]>('/me/help-requests'), [online_]);
  const replyToHelp = useCallback(
    async (helpId: string, body: string) => {
      await online_(`/help-requests/${helpId}/messages`, { method: 'POST', body: { body } });
    },
    [online_]
  );

  const enableLocation = useCallback(async () => {
    setLocationStatus(await startTracking().catch((): LocationStatus => 'off'));
  }, []);

  // A job notification while the app is open: fetch the new list.
  useEffect(() => onNotificationReceived(() => void refresh()), [refresh]);

  // Register for push once the server is reachable; stop it and wipe saved data when signing out.
  useEffect(() => {
    if (!online || !saved.me || pushRegistered.current) return;
    void (async () => {
      try {
        const device = await pushToken();
        if (!device) return;
        await api(await auth.accessToken(), '/me/devices', { method: 'POST', body: device });
        pushRegistered.current = device.token;
      } catch {
        // Not fatal: without push, jobs still arrive by SMS. Tried again next time the app opens.
      }
    })();
  }, [online, saved.me, auth]);

  useEffect(() => {
    auth.setBeforeSignOut(async () => {
      const token = pushRegistered.current;
      pushRegistered.current = null;
      if (token) {
        await api(await auth.accessToken(), '/me/devices/remove', { method: 'POST', body: { token } }).catch(
          () => undefined
        );
      }
      await stopTracking().catch(() => undefined);
      await clearLocations().catch(() => undefined);
      clearAll();
    });
    return () => auth.setBeforeSignOut(null);
  }, [auth]);

  const value = useMemo<OfflineState>(() => {
    const jobs = applyPending(saved.jobs, queue);
    return {
      me: saved.me,
      jobs,
      job: (id) => {
        const detail = saved.details[id];
        if (!detail) return null;
        const [shown] = applyPending([detail], queue);
        return shown ?? null;
      },
      queue,
      conflicts,
      online,
      busy,
      doneToday: (saved.doneToday ?? 0) + queue.filter((a) => a.kind === 'resolve').length,
      savedAt: saved.savedAt,
      error,
      sendNow: refresh,
      locationStatus,
      enableLocation,
      van: saved.van ?? null,
      sendHandoverCode,
      askForHelp,
      helpRequests,
      replyToHelp,
      refresh,
      refreshJob,
      perform,
      keepPhoto,
      setDuty,
      dismissConflict
    };
  }, [
    saved,
    queue,
    conflicts,
    online,
    busy,
    error,
    refresh,
    refreshJob,
    perform,
    setDuty,
    dismissConflict,
    locationStatus,
    enableLocation,
    sendHandoverCode,
    askForHelp,
    helpRequests,
    replyToHelp
  ]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineState {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
