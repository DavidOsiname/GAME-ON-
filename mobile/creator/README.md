# GAME ON CREATOR — Native mobile app

GAME ON CREATOR is a separate React Native + Expo app for developers. It is not combined with GAME ON STORE. The two mobile apps share the Game ON Supabase project while keeping separate app identifiers, navigation and user experiences.

## Included in this milestone

- Supabase email sign-up and sign-in with persistent mobile sessions
- On-device demo mode when no Supabase project is configured
- Developer studio onboarding
- Studio verification status
- Game listing creation with platform, genre, monetization details and optional cover artwork uploads
- Cover art uploads to the public `game-covers` bucket with studio-owner Storage policies, a 5 MiB cap and JPG/PNG/WebP validation
- Developer game list with submission and publication status
- Build-status screen that calls the authenticated Creator API when its base URL is configured
- Separate Android APK and iOS build profiles


- Edit draft and submitted listing details from the mobile **My Games** screen.
- Edit and resubmit rejected listings using the database's owner-checked `resubmit_game` function.
- Published and actively reviewed listings are read-only in the mobile app; review status and publication remain Game ON-controlled.
- Replace cover artwork on editable listings with a versioned upload; the prior object is removed only after the game record points to the new image.

## Secure boundaries

The mobile app uses only the public Supabase URL and publishable/anon key. Supabase Row Level Security is responsible for protecting studio and game records. Never bundle a service-role key, database password, payment secret or scanner secret in a mobile app.

Game cover art is a public catalogue asset. Migration `0011_game_cover_artwork.sql` creates the public `game-covers` bucket and restricts writes to the owning studio; only JPG, PNG and WebP images up to 5 MiB are accepted. The mobile app does not write to the private build metadata table or upload executable game files directly to the quarantine bucket. Build ingestion remains in the Creator server API, which checks the developer's session and studio ownership before issuing a private upload URL. The upload/scanning service must be configured before real build uploads can be enabled.

Analytics and sales are not displayed as live figures in this initial mobile milestone. They require the server-side reporting endpoints and a configured backend.

## Run locally

1. Install Node.js 22.13 or newer and npm 10 or newer.
2. Copy \`.env.example\` to \`.env\` and set the public Supabase project URL and publishable/anon key.
3. Optionally set \`EXPO_PUBLIC_CREATOR_API_URL\` to the Creator server base URL.
4. From this directory run:

\`\`\`bash
npm install
npx expo install --fix
npm run typecheck
npm start
\`\`\`

## Build installable apps

Before the first cloud build, an adult project owner should run these commands from this app directory. Repeat them separately for STORE and CREATOR so each app gets its own EAS project ID in app.json:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli credentials --platform android
```

The owner should review and securely back up the Android signing credentials before sharing any APK. Keep GAME ON STORE and GAME ON CREATOR linked to separate EAS projects so their build credentials remain separate. EAS uses remote credentials by default. Keep GAME ON CREATOR and GAME ON STORE linked to separate EAS projects so their build credentials remain separate. EAS remote credentials are used by default; the project owner must review and securely back up the Android signing credentials.

```bash
# Internal testing APK
npx eas-cli build --platform android --profile preview

# Production-signed, directly installable APK
npx eas-cli build --platform android --profile production-apk

# Google Play upload bundle (AAB)
npx eas-cli build --platform android --profile production

# iOS preview build (Apple distribution setup is separate)
npx eas-cli build --platform ios --profile preview
```

The preview profile is for internal testing, production-apk produces a signed Release APK for direct installation, and production produces the Play-optimised AAB. Expo SDK 58 supplies Android target API 36 by default. The GitHub validation workflow exports the Android and iOS bundles and compiles a debug Android APK; it does not sign an iOS IPA.

## Connect the mobile app to the hosted Creator API

The private build-history and executable-build upload features call the same Next.js Creator server used by the web portal. They are not hosted by the mobile app and must never be pointed directly at a database or service-role key.

After the Creator service is deployed behind HTTPS:

1. Confirm the Creator server responds at `https://YOUR-CREATOR-DOMAIN/api/health` and that its readiness endpoint reports the required backend configuration.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Create the secret named `EXPO_PUBLIC_CREATOR_API_URL` with only the Creator HTTPS origin, for example `https://creator.example.com` (no trailing slash and no `/api` suffix).
4. Confirm the existing mobile workflow reads this secret, then run the **GAME ON CREATOR mobile** workflow again. The URL is embedded at build time, so an APK built before the secret was set must be rebuilt.
5. Install the new APK and verify the Build history screen can call `/api/builds`.

The server's `/api/builds/upload-url` and `/api/builds/finalize` routes require a valid signed-in developer session. The server validates the Supabase bearer token and uses its own server-only secret to create a one-time upload URL for the private `game-build-quarantine` bucket. Never put `SUPABASE_SERVICE_ROLE_KEY`, a Supabase secret key, database password, Paystack secret or scanner webhook secret in an `EXPO_PUBLIC_` variable or in the mobile app.

**Important:** real executable-build uploads also require a verified developer studio and a supported game listing. A working URL alone does not bypass studio verification, the 50 MiB upload limit, malware scanning or Game ON release approval. Keep the upload feature for internal testing until the scanner and release workflow are deployed and verified.
