/** The words written with a step in a ticket's history: a note (notes, close, resolve) or a reason (cancel, hold). */
export function eventNote(data: Record<string, unknown>): string | null {
  for (const key of ['note', 'reason', 'message'] as const) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}
