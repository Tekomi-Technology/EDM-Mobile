import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(os: 'android' | 'ios') {
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: os } }));
  // Metro bundles assets.android.ts into Android and assets.ts into iOS.
  const [{ APP_NAME }, assets] = await Promise.all([
    import('./appName'),
    os === 'android' ? import('./assets.android') : import('./assets')
  ]);
  return { APP_NAME, ...assets };
}

afterEach(() => vi.doUnmock('react-native'));

describe('brand per store', () => {
  it('Android (Google Play): Tekomi Taski with the Tekomi logo, nothing of EDM', async () => {
    const b = await load('android');
    expect(b.APP_NAME).toBe('Tekomi Taski');
    expect(String(b.BRAND_EMBLEM)).toContain('tekomi');
    expect(String(b.BRAND_LOGO)).toContain('tekomi');
    expect(b.BRAND_LABEL).toBe('Tekomi');
  });

  it('iOS (App Store): EDM Service with the EDM logo, unchanged', async () => {
    const b = await load('ios');
    expect(b.APP_NAME).toBe('EDM Service');
    expect(String(b.BRAND_EMBLEM)).toContain('edm');
    expect(String(b.BRAND_LOGO)).toContain('edm');
    expect(b.BRAND_LABEL).toBe('Electricidade de Moçambique, E.P.');
  });
});
