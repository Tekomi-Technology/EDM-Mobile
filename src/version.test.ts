import { describe, expect, it } from 'vitest';
import { shortVersion } from './version';

describe('shortVersion: the version shown on the Me tab', () => {
  it('shows major.minor of the app version', () => {
    expect(shortVersion('1.1.0')).toBe('1.1');
    expect(shortVersion('2.0.3')).toBe('2.0');
  });
  it('falls back to 1.0 when the version is not known', () => {
    expect(shortVersion(undefined)).toBe('1.0');
  });
});
