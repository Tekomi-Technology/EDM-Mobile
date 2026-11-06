import emblem from '../assets/tekomi-emblem.png';
import logo from '../assets/tekomi-logo.png';

// Android (Google Play): Google Play refused "EDM" and the EDM emblem from Tekomi's account (Impersonation policy,
// 5 Nov 2026), so the Android app carries the Tekomi brand, and no EDM image is bundled into it, until EDM's
// written permission is accepted. Same exports as assets.ts, which iOS uses.

/** Small square mark for the Jobs header. */
export const BRAND_EMBLEM = emblem;
/** Mark with the name underneath, for the sign-in screen. */
export const BRAND_LOGO = logo;
/** What a screen reader says for the logo. */
export const BRAND_LABEL = 'Tekomi';
