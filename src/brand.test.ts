import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(os: 'android' | 'ios') {
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: os } }));
  const [{ APP_NAME }, assets] = await Promise.all([import('./appName'), import('./assets')]);
  return { APP_NAME, ...assets };
}

afterEach(() => vi.doUnmock('react-native'));

describe('brand: Tekomi Taski on both stores', () => {
  for (const os of ['android', 'ios'] as const) {
    it(`${os}: Tekomi Taski with the Tekomi logo, nothing of EDM`, async () => {
      const b = await load(os);
      expect(b.APP_NAME).toBe('Tekomi Taski');
      expect(String(b.BRAND_EMBLEM)).toContain('tekomi');
      expect(String(b.BRAND_LOGO)).toContain('tekomi');
      expect(b.BRAND_LABEL).toBe('Tekomi');
    });
  }
});
