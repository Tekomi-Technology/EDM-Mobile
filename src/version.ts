/** "1.1" for app version 1.1.0, as shown on the Me tab. */
export function shortVersion(version: string | undefined): string {
  const [major, minor] = (version ?? '').split('.');
  return major && minor ? `${major}.${minor}` : '1.0';
}
