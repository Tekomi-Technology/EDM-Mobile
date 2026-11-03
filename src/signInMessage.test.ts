import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({}));
vi.mock('./config', () => ({ API_URL: 'http://test/api' }));
vi.mock('./i18n', () => ({ t: (s: string) => `T:${s}` }));

import { ApiRequestError } from './api';
import { signInMessage } from './auth';

describe('signInMessage', () => {
  it('says, translated, that an account without a role cannot sign in', () => {
    const err = new ApiRequestError({ statusCode: 403, code: 'NO_ROLE', message: 'server words' });
    expect(signInMessage(err)).toBe('T:Your account has no role yet. Ask an administrator.');
  });
});
