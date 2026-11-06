/** "1.1" for app version 1.1.0, as shown on the Me tab. */
export function shortVersion(version: string | undefined): string {
  const [major, minor] = (version ?? '').split('.');
  return major && minor ? `${major}.${minor}` : '1.0';
}

interface VersionConfig {
  version?: string;
  android?: { version?: string };
  ios?: { version?: string };
}

/** The version of this platform's build: android.version / ios.version when set, else the shared version. */
export function platformVersion(
  config: VersionConfig | null | undefined,
  os: 'android' | 'ios' | string
): string | undefined {
  const own = os === 'android' ? config?.android?.version : os === 'ios' ? config?.ios?.version : undefined;
  return own ?? config?.version;
}
