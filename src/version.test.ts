import { describe, expect, it } from 'vitest';
import { platformVersion, shortVersion } from './version';

describe('shortVersion: the version shown on the Me tab', () => {
  it('shows major.minor of the app version', () => {
    expect(shortVersion('1.1.0')).toBe('1.1');
    expect(shortVersion('2.0.3')).toBe('2.0');
  });
  it('falls back to 1.0 when the version is not known', () => {
    expect(shortVersion(undefined)).toBe('1.0');
  });
});

describe('platformVersion: the version the store shows for this phone', () => {
  const config = { version: '1.1.0', android: { version: '1.0.0' } };
  it('takes android.version on Android (Google Play counts from 1.0.0)', () => {
    expect(platformVersion(config, 'android')).toBe('1.0.0');
  });
  it('takes the shared version where the platform has none (iOS)', () => {
    expect(platformVersion(config, 'ios')).toBe('1.1.0');
  });
  it('is undefined when the config is not known', () => {
    expect(platformVersion(null, 'android')).toBeUndefined();
  });
});
