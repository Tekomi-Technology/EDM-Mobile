# Tekomi Taski (mobile app)

The mobile app of EDM Tasks, for everyone at EDM. Field staff get their jobs: accept / start / pause / finish,
photos, materials from the van, new customer surveys and connections, help from the office, and location sharing
while on duty. It works offline and sends what was done when there is signal. Team managers, operations
supervisors and administrators get the office screens (see below).

Expo SDK 58 · React Native 0.88 · TypeScript. The server (API, web, database) is in the
[EDM-Task-Management](https://github.com/Tekomi-Technology) repository; the app talks to it only through its API.

## Name and logo

The app is **Tekomi Taski** with the Tekomi logo on both Google Play and the App Store. Google Play refused the EDM
name and emblem from Tekomi's developer account (Impersonation policy, 5 November 2026), so both stores carry the
Tekomi brand until EDM's written permission is accepted. The name is `name` in `app.json` and `src/appName.ts`; the
icons are `assets/tekomi-icon.png` and `assets/android-icon-*.png`; the logos inside the app come from `src/assets.ts`.
The bundle ID and Android package stay `mz.co.edm.field`: the stores do not allow changing them.

## Requirements

- Node 24 and pnpm 10 (`corepack enable`)
- The EDM Tasks API running: see the EDM-Task-Management README
- On the phone: Expo Go, or a development build for push notifications

`expo-font` is held at 58.0.10 in `package.json`, and `expo install` is told to leave it alone. Expo ships it
already compiled for iOS. Version 58.0.11 was compiled against a newer `expo-modules-core` than the one `expo`
58.0.19 brings, so the iOS app closed at launch with "Symbol not found". When you update `expo`, update `expo-font`
with it, and check the new build opens on an iPhone before sending it to the App Store.

## Run the app on a phone

1. Phone and computer on the same Wi-Fi. Find your computer's LAN address (e.g. `192.168.1.20`).
2. In EDM-Task-Management, let photos be reached from the phone: in its .env,
   `S3_PUBLIC_ENDPOINT=http://192.168.1.20:59000`, then `pnpm services:up` and start the API.
3. Here:
   ```bash
   pnpm install
   cp .env.example .env      # put in your LAN address (.env is not committed)
   pnpm start                # scan the QR code with Expo Go
   ```
4. Sign in as a field staff member of the sample data, e.g. `armando.cossa` / `Edm@2026`.

## Office screens

After sign-in the app picks its screens from the highest role (`src/roles.ts`): admin, then operations supervisor
(`technical_manager`), then team manager; everyone else gets the field staff screens, which are unchanged. The roles
are kept on the phone so the right screens open without signal.

- **Team manager:** My team (late jobs, jobs nobody has, help requests), the team's tickets, the team on the map,
  notifications, and + for customer tickets and planned maintenance for their own team.
- **Operations supervisor:** Overview (network incidents, jobs waiting for the check, late jobs, help requests), every
  ticket, everyone on the map, and + for surveys and connections too.
- **Administrator:** as the supervisor, plus accounts and roles in Me (change roles, block, reset a password). New
  accounts, areas and teams, API keys and sign-in security stay on the website.

Office screens need a connection; they call the same API endpoints as the website (`src/office/officeApi.ts`). They
get no push notifications: the Notifications tab and SMS. The map uses `react-native-maps`: Apple Maps on iOS,
Google Maps on Android with the key from the EAS environment variable `GOOGLE_MAPS_ANDROID_KEY` (`app.config.js`).

## Data formats (`src/types.ts`)

`src/types.ts` describes the data the app exchanges with the EDM Tasks API: a ticket's fields, the help request
kinds, the materials on a job, and so on. The API's own definitions (EDM-Task-Management, `apps/api/src/contract`)
are the reference: when the API changes a format, change `src/types.ts` to match. The API description at
`/api/docs` on the server shows the current formats. The file holds no data: the app reads and writes everything
through the API, on the same database as the web.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                        # the offline queue (src/offline), without React Native
pnpm exec expo export --platform android --output-dir dist   # the JavaScript bundle builds
```

CI (`.github/workflows/ci.yml`) runs the same on every push and pull request.
