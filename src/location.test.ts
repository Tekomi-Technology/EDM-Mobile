import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  platform: 'android',
  answer: 'Continue',
  alert: vi.fn(),
  getForeground: vi.fn(),
  requestForeground: vi.fn(),
  getBackground: vi.fn(),
  requestBackground: vi.fn(),
  start: vi.fn()
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return m.platform;
    }
  },
  Alert: { alert: m.alert }
}));
vi.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: m.getForeground,
  requestForegroundPermissionsAsync: m.requestForeground,
  getBackgroundPermissionsAsync: m.getBackground,
  requestBackgroundPermissionsAsync: m.requestBackground,
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: m.start
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
vi.mock('./i18n', () => ({ t: (s: string) => s }));
vi.mock('./offline/storage', () => ({ readJson: vi.fn(), writeJson: vi.fn() }));

import { startTracking } from './location';

beforeEach(() => {
  vi.clearAllMocks();
  m.platform = 'android';
  m.answer = 'Continue';
  m.getForeground.mockResolvedValue({ granted: false, canAskAgain: true });
  m.requestForeground.mockResolvedValue({ granted: true });
  m.getBackground.mockResolvedValue({ granted: false, canAskAgain: true });
  m.requestBackground.mockResolvedValue({ granted: true });
  m.alert.mockImplementation((_t, _b, buttons: { text: string; onPress: () => void }[]) => {
    buttons.find((b) => b.text === m.answer)?.onPress();
  });
});

describe('startTracking on Android', () => {
  it('explains location before the permission dialog, and starts sharing', async () => {
    await expect(startTracking()).resolves.toBe('on');
    expect(m.alert.mock.invocationCallOrder[0]).toBeLessThan(
      m.requestForeground.mock.invocationCallOrder[0]!
    );
    expect(m.alert.mock.calls[0]![1]).toContain('even when the app is closed or not in use');
    expect(m.start.mock.calls[0]![1].foregroundService.notificationTitle).toBe('EDM Tasks');
  });

  it('does not ask for the permission after "Not now"', async () => {
    m.answer = 'Not now';
    await expect(startTracking()).resolves.toBe('off');
    expect(m.requestForeground).not.toHaveBeenCalled();
    expect(m.start).not.toHaveBeenCalled();
  });

  it('skips the explanation when location is already allowed', async () => {
    m.getForeground.mockResolvedValue({ granted: true, canAskAgain: true });
    await expect(startTracking()).resolves.toBe('on');
    expect(m.alert).not.toHaveBeenCalled();
  });

  it('does not show the explanation when Android will not ask again', async () => {
    m.getForeground.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(startTracking()).resolves.toBe('denied');
    expect(m.alert).not.toHaveBeenCalled();
  });

  it('never asks for location "all the time"', async () => {
    await startTracking(true);
    expect(m.getBackground).not.toHaveBeenCalled();
    expect(m.requestBackground).not.toHaveBeenCalled();
  });
});

describe('startTracking on iOS', () => {
  it('keeps asking for "all the time", without the Android explanation', async () => {
    m.platform = 'ios';
    await expect(startTracking(true)).resolves.toBe('on');
    expect(m.alert).not.toHaveBeenCalled();
    expect(m.requestBackground).toHaveBeenCalledOnce();
  });
});
