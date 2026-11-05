# GAME ON STORE — Native mobile app

This is the first native mobile client in the GAME ON ecosystem. It is a separate app from GAME ON CREATOR and is built with React Native + Expo so the same codebase targets Android and iOS.

## Current milestone

- Native Store navigation and catalogue UI
- Search and genre filtering
- Game detail view with published developer cover artwork
- Local wishlist, with Supabase sync for signed-in users
- Supabase email sign-up/sign-in and persistent mobile sessions
- Account-linked player library, loaded from the user's own `user_library` rows
- Add-to-library flow for published free titles, subject to database RLS; paid titles cannot be self-granted
- Purchase history and refund-status display from the signed-in player's own server-verified records
- Player notification inbox with read-state updates restricted to the signed-in account
- Player ratings and reviews for games in the player's library; new or edited reviews return to moderation, and self-reviews of developer-owned games are blocked by database policy
- Explicit demo data when no live Supabase project is configured
- EAS profiles for internal Android APK builds and iOS builds

The catalogue data in `src/data/demo-games.ts` is fictional sample data. It is not a live or approved marketplace catalogue. Purchases, refunds, game-file delivery, ratings and push notifications are not enabled in this native milestone.

## Run locally

1. Install Node.js 22.13 or newer and npm 10 or newer.
2. Copy `.env.example` to `.env` and set the public Supabase project URL and publishable/anon key.
3. From this directory run:

```bash
npm install
npx expo install --fix
npm run typecheck
npm start
```

Use Expo Go while developing when the installed SDK is compatible. Native build testing should use an EAS development/preview build.

## Protected Android release workflow

After the adult owner has linked the EAS project, configured the `production` environment variables and prepared remote Android signing credentials, the repository owner must create a protected GitHub Actions environment named `game-on-android-release`, add an adult required reviewer, and save the Expo access token as the environment secret `EXPO_TOKEN`. The manual **GAME ON Android release build** workflow then offers a choice between `production-apk` (signed direct-install APK) and `production` (Google Play AAB). It waits for the EAS build to finish, freezes credential changes, and does not submit the AAB to Google Play or publish a rollout.

## Configure Expo production environment

EAS Build uses variables stored in the Expo project, not the GitHub Actions repository secrets. After the project owner has run `eas init`, set the public client configuration in the STORE EAS project:

```bash
npx eas-cli env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT.supabase.co" --environment production --visibility plaintext
npx eas-cli env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_PUBLISHABLE_OR_ANON_KEY" --environment production --visibility sensitive
```

Use the real URL and publishable/anon key from the project owner's Supabase dashboard. These are client values, not service-role credentials. Never place a Supabase secret key, service-role key, database password, Paystack secret or scanner secret in an Expo public environment variable. The production and production-apk EAS profiles use the `production` environment; the preview profile uses `preview`.

## Create installable builds

Before the first cloud build, an adult project owner should run these commands from this app directory. Repeat them separately for STORE and CREATOR so each app gets its own EAS project ID in app.json:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli credentials --platform android
```

The owner should review and securely back up the Android signing credentials before sharing any APK. Keep GAME ON STORE and GAME ON CREATOR linked to separate EAS projects so their build credentials remain separate. EAS uses remote credentials by default. Keep GAME ON STORE and GAME ON CREATOR linked to separate EAS projects so their build credentials remain separate. EAS remote credentials are used by default; the project owner must review and securely back up the Android signing credentials.

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

The preview profile is for internal testing, production-apk produces a signed Release APK for direct installation, and production produces the Play-optimised AAB. The Android app targets API 36 by default through Expo SDK 58. A physical iPhone install or App Store release requires the appropriate Apple developer account, signing and distribution setup.

