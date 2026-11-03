import { describe, expect, it } from 'vitest';
import { mapAvailable } from './mapAvailable';

describe('mapAvailable: whether this build can draw the map', () => {
  it('always on iPhone (Apple Maps needs no key)', () => {
    expect(mapAvailable('ios', {})).toBe(true);
  });
  it('on Android only when the build has the Google Maps key', () => {
    expect(mapAvailable('android', { googleMapsKey: true })).toBe(true);
    expect(mapAvailable('android', { googleMapsKey: false })).toBe(false);
    expect(mapAvailable('android', undefined)).toBe(false);
  });
});
