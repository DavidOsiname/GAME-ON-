# GAME ON STORE — Native mobile app

This is the first native mobile client in the GAME ON ecosystem. It is a separate app from GAME ON CREATOR and is built with React Native + Expo so the same codebase targets Android and iOS.

## Current milestone

- Native Store navigation and catalogue UI
- Search and genre filtering
- Game detail view
- Local wishlist, with Supabase sync for signed-in users
- Supabase email sign-up/sign-in and persistent mobile sessions
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

After an adult project owner creates or links the Expo/EAS project and configures its environment:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

The Android preview profile is configured to output an APK for direct device testing. The iOS profile produces a signed iOS build; installing on physical iPhones and App Store release require the appropriate Apple developer account, signing and distribution setup.

Do not commit signing credentials, service-role keys, payment secrets, database passwords or scanner credentials. Live payments remain disabled until the adult account owner completes the necessary merchant and compliance checks.
