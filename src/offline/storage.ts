import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Saved data lives in the app's documents folder, which the phone does not clean up on its own (unlike the
 * cache folder, where the camera puts photos).
 */
const root = new Directory(Paths.document, 'edm-offline');
const photos = new Directory(Paths.document, 'edm-photos');

function ensure(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true });
}

export async function readJson<T>(name: string): Promise<T | null> {
  const file = new File(root, `${name}.json`);
  if (!file.exists) return null;
  try {
    return JSON.parse(await file.text()) as T;
  } catch {
    return null;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  ensure(root);
  const file = new File(root, `${name}.json`);
  await file.write(JSON.stringify(value));
}

/** Copies a photo out of the camera's temporary folder so it survives until it has been sent. */
export function keepPhoto(uri: string): string {
  ensure(photos);
  const target = new File(photos, `${randomUUID()}.jpg`);
  new File(uri).copySync(target);
  return target.uri;
}

export function deletePhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone; nothing to do.
  }
}

/** Removes everything saved for the person who is signing out. */
export function clearAll(): void {
  for (const dir of [root, photos]) {
    if (dir.exists) dir.delete();
  }
}
