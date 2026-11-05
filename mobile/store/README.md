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

## Create installable builds

Before the first cloud build, an adult project owner must sign in to Expo and initialise this app as its own EAS project from this directory. Keep GAME ON STORE and GAME ON CREATOR linked to separate EAS projects so their build credentials remain separate. EAS remote credentials are used by default; the project owner must review and securely back up the Android signing credentials.

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

