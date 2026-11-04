import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.fn();
vi.mock('../api', () => ({ api: (...args: unknown[]) => api(...args) }));

import { officeApi } from './officeApi';

describe('officeApi.tickets', () => {
  beforeEach(() => api.mockReset());

  it('returns the tickets from the page the API sends ({ items, total })', async () => {
    const ticket = { id: 't1', code: 'TK-26-00001' };
    api.mockResolvedValue({ items: [ticket], total: 34 });

    const tickets = await officeApi.tickets('token', { view: 'waiting_check', limit: 20 });

    expect(tickets).toEqual([ticket]);
    expect(api).toHaveBeenCalledWith('token', '/tickets?view=waiting_check&limit=20');
  });
});
