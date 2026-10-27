# EDM Field (mobile app)

The app field staff use for EDM Tasks: their jobs, accept / start / pause / finish, photos, materials from the van,
new customer surveys and connections, help from the back office, and location sharing while on duty. It works
offline and sends what was done when there is signal.

Expo SDK 58 · React Native 0.88 · TypeScript. The server (API, web, database) is in the
[EDM-Task-Management](https://github.com/Tekomi-Technology) repository; the app talks to it only through its API.

## Requirements

- Node 24 and pnpm 10 (`corepack enable`)
- The EDM Tasks stack running (API, Keycloak): see the EDM-Task-Management README
- On the phone: Expo Go, or a development build for push notifications

## Run the app on a phone

1. Phone and computer on the same Wi-Fi. Find your computer's LAN address (e.g. `192.168.1.20`).
2. In EDM-Task-Management, start Keycloak with that address as its public URL, and point the API at it, because
   the address is written into every token:
   ```bash
   KEYCLOAK_PUBLIC_URL=http://192.168.1.20:58080 pnpm infra:up
   # in its .env: KEYCLOAK_URL=http://192.168.1.20:58080 and S3_PUBLIC_ENDPOINT=http://192.168.1.20:59000
   ```
3. Here:
   ```bash
   pnpm install
   cp .env.example .env      # put in your LAN address (.env is not committed)
   pnpm start                # scan the QR code with Expo Go
   ```
4. Sign in as a field staff member of the sample data, e.g. `armando.cossa` / `Edm@2026`.

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
