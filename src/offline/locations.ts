/**
 * Positions recorded while on duty wait in a small queue on the phone until they reach the server.
 * Kept free of React Native so it can be tested on its own.
 */
export interface QueuedPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  recordedAt: string;
}

/** About a day of points at one per minute; older ones are dropped first when the phone stays offline. */
export const MAX_QUEUED_POINTS = 1500;
/** The API accepts up to 500 points per request. */
export const BATCH_SIZE = 500;

/** Adds new points in time order, without duplicates, keeping only the newest MAX_QUEUED_POINTS. */
export function appendPoints(
  queue: QueuedPoint[],
  points: QueuedPoint[],
  max = MAX_QUEUED_POINTS
): QueuedPoint[] {
  const seen = new Set(queue.map((p) => p.recordedAt));
  const merged = [...queue, ...points.filter((p) => !seen.has(p.recordedAt))].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt)
  );
  return merged.slice(Math.max(0, merged.length - max));
}

/**
 * Sends the queue oldest first in batches. Returns what is still waiting (everything after the first failed
 * batch), so a lost connection half-way loses nothing and sends nothing twice.
 */
export async function uploadPoints(
  queue: QueuedPoint[],
  send: (batch: QueuedPoint[]) => Promise<void>
): Promise<QueuedPoint[]> {
  let remaining = queue;
  while (remaining.length > 0) {
    const batch = remaining.slice(0, BATCH_SIZE);
    try {
      await send(batch);
    } catch {
      return remaining;
    }
    remaining = remaining.slice(batch.length);
  }
  return remaining;
}
