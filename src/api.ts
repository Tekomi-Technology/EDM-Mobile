import type { ApiError } from './shared';
import { API_URL } from './config';

export class ApiRequestError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
  }
}

const offline = () =>
  new ApiRequestError({
    statusCode: 0,
    code: 'OFFLINE',
    message: 'No connection. Your work is saved on the phone and will be sent later.'
  });

export async function api<T>(
  token: string,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    // No signal, server unreachable, or the request took too long: all mean "try again later".
    throw offline();
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(
      (data as ApiError | null) ?? { statusCode: res.status, code: 'ERROR', message: 'Something went wrong' }
    );
  }
  return data as T;
}

/** Uploads a photo straight to storage through the short-lived URL the API returns. */
export async function uploadPhoto(
  token: string,
  ticketId: string,
  uri: string,
  fileName: string
): Promise<string> {
  const file = await (await fetch(uri)).blob();
  const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const target = await api<{ attachmentId: string; uploadUrl: string; headers: Record<string, string> }>(
    token,
    `/tickets/${ticketId}/attachments`,
    { method: 'POST', body: { fileName, contentType, size: file.size } }
  );
  let put: Response;
  try {
    put = await fetch(target.uploadUrl, {
      method: 'PUT',
      headers: target.headers,
      body: file,
      signal: AbortSignal.timeout(120_000)
    });
  } catch {
    throw offline();
  }
  if (!put.ok) {
    throw new ApiRequestError({
      statusCode: put.status >= 500 ? put.status : 502,
      code: 'UPLOAD_FAILED',
      message: 'The photo could not be uploaded'
    });
  }
  return target.attachmentId;
}
