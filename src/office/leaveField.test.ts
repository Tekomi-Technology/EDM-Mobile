import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ stop: vi.fn(), clear: vi.fn() }));
vi.mock('../location', () => ({ stopTracking: m.stop, clearLocations: m.clear }));

import { leaveFieldMode } from './leaveField';

beforeEach(() => {
  vi.clearAllMocks();
  m.stop.mockResolvedValue(undefined);
  m.clear.mockResolvedValue(undefined);
});

describe('leaveFieldMode: office screens leave nothing of the field app running', () => {
  it('stops sharing the location and forgets positions not sent', async () => {
    await leaveFieldMode();
    expect(m.stop).toHaveBeenCalledOnce();
    expect(m.clear).toHaveBeenCalledOnce();
  });

  it('still forgets the positions when stopping fails', async () => {
    m.stop.mockRejectedValue(new Error('no task'));
    await expect(leaveFieldMode()).resolves.toBeUndefined();
    expect(m.clear).toHaveBeenCalledOnce();
  });
});
