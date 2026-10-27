import type { TicketStatus } from '../shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPending,
  photosNoLongerNeeded,
  resolveBody,
  syncQueue,
  type QueuedAction,
  type SyncDeps
} from './engine';

const ME = 'armando';
let n = 0;
function action(kind: QueuedAction['kind'], ticketId = 't1', extra: object = {}): QueuedAction {
  n += 1;
  const base = { id: `a${n}`, ticketId, ticketCode: `TK-${ticketId}`, occurredAt: '2026-10-27T08:00:00Z' };
  if (kind === 'decline' || kind === 'hold') return { ...base, kind, reason: 'No fuse', ...extra };
  if (kind === 'resolve') return { ...base, kind, note: 'Fixed', photos: [], ...extra } as QueuedAction;
  return { ...base, kind };
}

const offline = { error: { statusCode: 0, code: 'OFFLINE', message: 'No connection' } };
const refused = (code = 'INVALID_TRANSITION') => ({
  error: { statusCode: 409, code, message: 'Not allowed now' }
});

function deps(
  send: SyncDeps['send'],
  server: Record<string, { status: TicketStatus; assigneeId: string | null } | null> = {}
): SyncDeps & { saved: QueuedAction[][] } {
  const saved: QueuedAction[][] = [];
  return {
    send,
    fetchTicket: async (id) => server[id] ?? null,
    myUserId: ME,
    save: async (q) => {
      saved.push(JSON.parse(JSON.stringify(q)));
    },
    saved
  };
}

describe('showing jobs with changes not sent yet', () => {
  it('shows the latest local status and hides declined jobs', () => {
    const jobs = [
      { id: 't1', status: 'assigned' as TicketStatus },
      { id: 't2', status: 'assigned' as TicketStatus },
      { id: 't3', status: 'in_progress' as TicketStatus }
    ];
    const shown = applyPending(jobs, [
      action('accept', 't1'),
      action('start', 't1'),
      action('decline', 't2')
    ]);
    expect(shown).toEqual([
      { id: 't1', status: 'in_progress' },
      { id: 't3', status: 'in_progress' }
    ]);
  });
});

describe('sending the queue when back online', () => {
  it('sends everything in order and saves progress after each step', async () => {
    const sent: string[] = [];
    const d = deps(async (a) => void sent.push(a.kind));
    const result = await syncQueue([action('accept'), action('start'), action('hold')], d);
    expect(result).toMatchObject({ outcome: 'done', queue: [], conflicts: [] });
    expect(sent).toEqual(['accept', 'start', 'hold']);
    expect(d.saved.map((q) => q.length)).toEqual([2, 1, 0]);
  });

  it('stops and keeps the rest when the connection drops half-way', async () => {
    const d = deps(async (a) => {
      if (a.kind === 'start') throw offline;
    });
    const result = await syncQueue([action('accept'), action('start'), action('hold')], d);
    expect(result.outcome).toBe('offline');
    expect(result.queue.map((a) => a.kind)).toEqual(['start', 'hold']);
  });

  it('keeps the queue when the server has a problem or the session has ended', async () => {
    for (const statusCode of [500, 503, 401]) {
      const d = deps(async () => {
        throw { error: { statusCode, message: 'Server problem' } };
      });
      const result = await syncQueue([action('accept')], d);
      expect(result).toMatchObject({ outcome: 'error', error: 'Server problem' });
      expect(result.queue).toHaveLength(1);
    }
  });

  it('drops an action quietly when it had already gone through (answer lost on a bad connection)', async () => {
    const d = deps(
      async (a) => {
        if (a.kind === 'accept') throw refused();
      },
      { t1: { status: 'accepted', assigneeId: ME } }
    );
    const result = await syncQueue([action('accept'), action('start')], d);
    expect(result).toMatchObject({ outcome: 'done', conflicts: [] });
  });

  it('reports a job cancelled while offline, and drops the later steps for that job only', async () => {
    const sent: string[] = [];
    const d = deps(
      async (a) => {
        if (a.ticketId === 't1') throw refused();
        sent.push(`${a.ticketId}:${a.kind}`);
      },
      { t1: { status: 'cancelled', assigneeId: ME } }
    );
    const result = await syncQueue(
      [action('start', 't1'), action('accept', 't2'), action('resolve', 't1')],
      d
    );
    expect(result.outcome).toBe('done');
    expect(sent).toEqual(['t2:accept']);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        ticketCode: 'TK-t1',
        message: 'Your starting work on TK-t1 was not saved: the job was cancelled.'
      })
    ]);
  });

  it('reports a job moved to someone else', async () => {
    const d = deps(
      async () => {
        throw { error: { statusCode: 403, code: 'NOT_ASSIGNEE', message: 'Only the assigned staff' } };
      },
      { t1: { status: 'assigned', assigneeId: 'ana' } }
    );
    const result = await syncQueue([action('accept')], d);
    expect(result.conflicts[0]!.message).toContain('given to someone else');
  });

  it('treats a decline as done when the job is no longer theirs', async () => {
    const d = deps(async () => {
      throw { error: { statusCode: 404, message: 'Ticket not found' } };
    });
    const result = await syncQueue([action('decline')], d);
    expect(result).toMatchObject({ outcome: 'done', conflicts: [], queue: [] });
  });

  it('does not upload a photo twice when finishing is retried', async () => {
    const photos = [
      { localUri: 'file:///p1.jpg', fileName: 'p1.jpg' },
      { localUri: 'file:///p2.jpg', fileName: 'p2.jpg' }
    ];
    const uploads: string[] = [];
    let failAfterFirstPhoto = true;
    const send: SyncDeps['send'] = async (a, photoUploaded) => {
      if (a.kind !== 'resolve') return;
      for (const [i, p] of a.photos.entries()) {
        if (p.attachmentId) continue;
        if (i === 1 && failAfterFirstPhoto) throw offline;
        uploads.push(p.fileName);
        await photoUploaded(i, `att-${i}`);
      }
    };
    const d = deps(send);
    const first = await syncQueue([action('resolve', 't1', { photos })], d);
    expect(first.outcome).toBe('offline');
    expect(first.queue[0]).toMatchObject({ photos: [{ attachmentId: 'att-0' }, { fileName: 'p2.jpg' }] });

    failAfterFirstPhoto = false;
    const second = await syncQueue(first.queue, d);
    expect(second.outcome).toBe('done');
    expect(uploads).toEqual(['p1.jpg', 'p2.jpg']);
  });

  it('keeps the queue if checking the ticket fails because the connection dropped', async () => {
    const d = deps(async () => {
      throw refused();
    });
    d.fetchTicket = vi.fn(async () => {
      throw offline;
    });
    const result = await syncQueue([action('accept')], d);
    expect(result).toMatchObject({ outcome: 'offline' });
    expect(result.queue).toHaveLength(1);
  });
});

describe('cleaning up photos', () => {
  it('lists photos of actions that are no longer queued', () => {
    const sent = action('resolve', 't1', { photos: [{ localUri: 'file:///a.jpg', fileName: 'a.jpg' }] });
    const waiting = action('resolve', 't2', { photos: [{ localUri: 'file:///b.jpg', fileName: 'b.jpg' }] });
    expect(photosNoLongerNeeded([sent, waiting], [waiting])).toEqual(['file:///a.jpg']);
  });
});

describe('resolveBody', () => {
  const photo = (i: number) => ({ localUri: `file:///p${i}.jpg`, fileName: `p${i}.jpg` });

  it('sends the materials, and an empty list when none were recorded', () => {
    const withLines = action('resolve', 't1', { materials: [{ itemId: 'i1', quantity: 12 }] });
    expect(resolveBody(withLines as never, [])).toMatchObject({
      materials: [{ itemId: 'i1', quantity: 12 }]
    });
    expect(resolveBody(action('resolve') as never, [])).toMatchObject({
      materials: [],
      installation: undefined
    });
  });

  it('points the signed handover form at the uploaded photo it was taken as', () => {
    const a = action('resolve', 't1', {
      photos: [photo(0), photo(1)],
      installation: { meterNumber: 'MTR-1', signedFormPhoto: 1 }
    });
    expect(resolveBody(a as never, ['att-0', 'att-1']).installation).toEqual({
      meterNumber: 'MTR-1',
      signedFormAttachmentId: 'att-1'
    });
  });

  it('passes the SMS code through when there is no signed form', () => {
    const a = action('resolve', 't1', { installation: { meterNumber: 'MTR-1', handoverCode: '4821' } });
    expect(resolveBody(a as never, []).installation).toEqual({
      meterNumber: 'MTR-1',
      handoverCode: '4821',
      signedFormAttachmentId: undefined
    });
  });
});
