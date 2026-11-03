import { describe, expect, it } from 'vitest';
import { eventNote } from './history';

describe('eventNote: the words written with a step in the history', () => {
  it('shows the note of a note, a close or a resolve (the API keeps it as note)', () => {
    expect(eventNote({ note: 'Replaced the fuse' })).toBe('Replaced the fuse');
  });
  it('shows the reason of a cancel, a pause or a take-back', () => {
    expect(eventNote({ reason: 'Duplicate of TK-1' })).toBe('Duplicate of TK-1');
  });
  it('shows nothing when there are no words', () => {
    expect(eventNote({})).toBeNull();
    expect(eventNote({ note: '' })).toBeNull();
    expect(eventNote({ note: 3 })).toBeNull();
  });
});
