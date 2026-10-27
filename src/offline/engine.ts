/**
 * The offline part of the app, kept free of React Native so it can be tested on its own.
 * Field staff often work where there is no signal: everything they do is put in a queue, shown at once, and sent
 * in order when the phone is back online. Nothing here talks to the network directly; callers pass that in.
 */
import type { MaterialLine, SurveyReport, TicketStatus } from '../types';

export interface QueuedPhoto {
  /** Copy of the photo in the app's own storage, so the phone cannot clean it up before it is sent. */
  localUri: string;
  fileName: string;
  /** Set once uploaded, so a retry does not upload it twice. */
  attachmentId?: string;
}

export type QueuedAction = {
  id: string;
  ticketId: string;
  ticketCode: string;
  /** When the person pressed the button; sent along so the history shows the real time. */
  occurredAt: string;
} & (
  | { kind: 'accept' | 'start' | 'resume' }
  | { kind: 'decline' | 'hold'; reason: string }
  | {
      kind: 'resolve';
      note: string;
      photos: QueuedPhoto[];
      /** Materials used, taken from the van. */
      materials?: MaterialLine[];
      /** New customer surveys. */
      survey?: SurveyReport;
      /** New connections: the meter, and the customer's confirmation (SMS code, or the photo at signedFormPhoto). */
      installation?: {
        meterNumber: string;
        sealNumber?: string;
        handoverCode?: string;
        signedFormPhoto?: number;
      };
    }
);

export type ActionKind = QueuedAction['kind'];

/** The body of POST /tickets/:id/resolve, once the photos are uploaded (attachmentIds in photo order). */
export function resolveBody(action: Extract<QueuedAction, { kind: 'resolve' }>, attachmentIds: string[]) {
  const { signedFormPhoto, ...installation } = action.installation ?? { meterNumber: '' };
  return {
    note: action.note,
    attachmentIds,
    materials: action.materials ?? [],
    survey: action.survey,
    installation: action.installation
      ? {
          ...installation,
          signedFormAttachmentId: signedFormPhoto !== undefined ? attachmentIds[signedFormPhoto] : undefined
        }
      : undefined
  };
}

/** Something done offline that could not be applied, e.g. the job was cancelled in the meantime. */
export interface Conflict {
  id: string;
  ticketCode: string;
  kind: ActionKind;
  message: string;
}

/** Status the job shows while the action waits to be sent; null means the job leaves the list. */
const STATUS_AFTER: Record<ActionKind, TicketStatus | null> = {
  accept: 'accepted',
  start: 'in_progress',
  hold: 'on_hold',
  resume: 'in_progress',
  resolve: 'resolved',
  decline: null
};

/** Server statuses showing the action already went through (e.g. the answer was lost on a bad connection). */
const ALREADY_DONE: Record<Exclude<ActionKind, 'decline'>, TicketStatus[]> = {
  accept: ['accepted', 'in_progress', 'on_hold', 'resolved', 'closed'],
  start: ['in_progress', 'on_hold', 'resolved', 'closed'],
  hold: ['on_hold', 'resolved', 'closed'],
  resume: ['in_progress', 'resolved', 'closed'],
  resolve: ['resolved', 'closed']
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  accept: 'accepting',
  start: 'starting work on',
  hold: 'pausing',
  resume: 'resuming',
  resolve: 'finishing',
  decline: 'declining'
};

/** Shows jobs as they will be once the queue is sent: new statuses, declined jobs removed. */
export function applyPending<T extends { id: string; status: TicketStatus }>(
  jobs: T[],
  queue: QueuedAction[]
): T[] {
  return jobs.flatMap((job) => {
    let status: TicketStatus | null = job.status;
    for (const a of queue) if (a.ticketId === job.id) status = STATUS_AFTER[a.kind];
    return status === null ? [] : [{ ...job, status }];
  });
}

/** Error shape thrown by the API client; statusCode 0 means the phone could not reach the server. */
export interface RequestFailure {
  error?: { statusCode: number; code?: string; message?: string };
  message?: string;
}

export interface SyncDeps {
  /** Sends one action; calls photoUploaded after each photo so progress survives a lost connection. */
  send(
    action: QueuedAction,
    photoUploaded: (index: number, attachmentId: string) => Promise<void>
  ): Promise<void>;
  /** The ticket as the server has it now, or null when this person can no longer see it. */
  fetchTicket(ticketId: string): Promise<{ status: TicketStatus; assigneeId: string | null } | null>;
  myUserId: string;
  /** Saves the remaining queue after every step, so a crash or a closed app loses nothing. */
  save(queue: QueuedAction[]): Promise<void>;
}

export interface SyncResult {
  queue: QueuedAction[];
  conflicts: Conflict[];
  /** done = queue empty; offline = no connection, try later; error = server problem or signed out, try later. */
  outcome: 'done' | 'offline' | 'error';
  error?: string;
}

const statusOf = (e: unknown) => (e as RequestFailure).error?.statusCode;
const messageOf = (e: unknown) =>
  (e as RequestFailure).error?.message ?? (e as RequestFailure).message ?? 'Something went wrong';

/**
 * Sends queued actions oldest first. Stops (keeping the queue) when offline or when the server has a problem.
 * When the server refuses an action, it looks at the ticket: if the action had in fact already gone through it
 * is dropped quietly; otherwise it becomes a conflict and later actions for the same job are dropped too.
 */
export async function syncQueue(queue: QueuedAction[], deps: SyncDeps): Promise<SyncResult> {
  let remaining = queue.map((a) => ({ ...a }) as QueuedAction);
  const conflicts: Conflict[] = [];

  while (remaining.length > 0) {
    const action = remaining[0]!;
    try {
      await deps.send(action, async (index, attachmentId) => {
        if (action.kind !== 'resolve') return;
        action.photos = action.photos.map((p, i) => (i === index ? { ...p, attachmentId } : p));
        await deps.save(remaining);
      });
      remaining = remaining.slice(1);
      await deps.save(remaining);
      continue;
    } catch (err) {
      const status = statusOf(err);
      if (status === 0) return { queue: remaining, conflicts, outcome: 'offline' };
      if (status === undefined || status === 401 || status === 408 || status === 429 || status >= 500) {
        return { queue: remaining, conflicts, outcome: 'error', error: messageOf(err) };
      }

      let server: Awaited<ReturnType<SyncDeps['fetchTicket']>>;
      try {
        server = await deps.fetchTicket(action.ticketId);
      } catch (fetchErr) {
        const offline = statusOf(fetchErr) === 0;
        return {
          queue: remaining,
          conflicts,
          outcome: offline ? 'offline' : 'error',
          error: messageOf(fetchErr)
        };
      }

      const stillMine = !!server && server.assigneeId === deps.myUserId;
      const done =
        action.kind === 'decline'
          ? !stillMine
          : stillMine && ALREADY_DONE[action.kind].includes(server!.status);
      if (done) {
        remaining = remaining.slice(1);
      } else {
        const why = !stillMine
          ? 'the job was given to someone else'
          : server!.status === 'cancelled'
            ? 'the job was cancelled'
            : messageOf(err);
        conflicts.push({
          id: action.id,
          ticketCode: action.ticketCode,
          kind: action.kind,
          message: `Your ${ACTION_LABEL[action.kind]} ${action.ticketCode} was not saved: ${why}.`
        });
        remaining = remaining.filter((a) => a.ticketId !== action.ticketId);
      }
      await deps.save(remaining);
    }
  }
  return { queue: remaining, conflicts, outcome: 'done' };
}

/** Photos the queue no longer needs, to delete from the phone after a sync. */
export function photosNoLongerNeeded(before: QueuedAction[], after: QueuedAction[]): string[] {
  const kept = new Set(after.flatMap((a) => (a.kind === 'resolve' ? a.photos.map((p) => p.localUri) : [])));
  return before
    .flatMap((a) => (a.kind === 'resolve' ? a.photos.map((p) => p.localUri) : []))
    .filter((u) => !kept.has(u));
}
