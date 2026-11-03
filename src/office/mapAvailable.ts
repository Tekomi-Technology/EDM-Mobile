/**
 * Google Maps on Android needs the key given at build time (app.config.js sets extra.googleMapsKey); without it,
 * opening a map would close the app, so the office map shows its list only. iOS uses Apple Maps, no key.
 */
export function mapAvailable(platform: string, extra: { googleMapsKey?: boolean } | undefined): boolean {
  return platform !== 'android' || extra?.googleMapsKey === true;
}
