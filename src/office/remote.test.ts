import { describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', () => ({ t: (s: string) => s }));
vi.mock('../auth', () => ({ useAuth: vi.fn() }));
vi.mock('../config', () => ({ API_URL: 'http://test/api' }));

import { ApiRequestError } from '../api';
import { describeError } from './remote';

describe('describeError: what an office screen shows when loading fails', () => {
  it('says offline when there is no connection', () => {
    const e = new ApiRequestError({ statusCode: 0, code: 'OFFLINE', message: 'No connection' });
    expect(describeError(e)).toEqual({
      error: 'No connection. Try again when you have signal.',
      offline: true
    });
  });

  it("shows the server's refusal as it is", () => {
    const e = new ApiRequestError({
      statusCode: 403,
      code: 'FORBIDDEN_ROLE',
      message: 'You do not have access to this action'
    });
    expect(describeError(e)).toEqual({ error: 'You do not have access to this action', offline: false });
  });

  it('falls back to a plain message for anything else', () => {
    expect(describeError(new Error('boom'))).toEqual({ error: 'Something went wrong', offline: false });
  });
});
