/**
 * On a phone, "localhost" is the phone itself: set these to your computer's LAN address in .env,
 * e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 (see "Run the app on a phone" in README.md).
 */
export const API_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api`;
export const colors = {
  brand: '#F39B3A',
  brandInk: '#2B1A07',
  brandSoft: '#FFF4E8',
  brandText: '#8F4C0B',
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  border: '#E8E8EC',
  text: '#1D2433',
  muted: '#5D6573',
  late: '#B42318',
  blue: '#1849A9',
  blueSoft: '#EFF4FF'
};
