import { describe, expect, it, vi } from 'vitest';
import { appendPoints, BATCH_SIZE, uploadPoints, type QueuedPoint } from './locations';

const point = (minute: number): QueuedPoint => ({
  lat: -25.93,
  lng: 32.47,
  recordedAt: new Date(Date.UTC(2026, 9, 27, 8, minute)).toISOString()
});

describe('positions waiting on the phone', () => {
  it('keeps them in time order without duplicates, dropping the oldest when full', () => {
    const queue = appendPoints([point(2), point(1)], [point(3), point(2)]);
    expect(queue.map((p) => p.recordedAt.slice(11, 16))).toEqual(['08:01', '08:02', '08:03']);
    const full = appendPoints(queue, [point(4), point(5)], 3);
    expect(full.map((p) => p.recordedAt.slice(11, 16))).toEqual(['08:03', '08:04', '08:05']);
  });

  it('sends them in batches and keeps what could not be sent', async () => {
    const many = Array.from({ length: BATCH_SIZE + 20 }, (_, i) => ({
      ...point(0),
      recordedAt: new Date(Date.UTC(2026, 9, 27, 8, 0, i)).toISOString()
    }));
    const sent: number[] = [];
    let fail = false;
    const send = vi.fn(async (batch: QueuedPoint[]) => {
      if (fail) throw new Error('offline');
      sent.push(batch.length);
      fail = true;
    });
    const left = await uploadPoints(many, send);
    expect(sent).toEqual([BATCH_SIZE]);
    expect(left).toHaveLength(20);
    fail = false;
    expect(await uploadPoints(left, async () => undefined)).toEqual([]);
  });
});
