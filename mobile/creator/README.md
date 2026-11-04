# GAME ON CREATOR — Native mobile app

GAME ON CREATOR is a separate React Native + Expo app for developers. It is not combined with GAME ON STORE. The two mobile apps share the Game ON Supabase project while keeping separate app identifiers, navigation and user experiences.

## Included in this milestone

- Supabase email sign-up and sign-in with persistent mobile sessions
- On-device demo mode when no Supabase project is configured
- Developer studio onboarding
- Studio verification status
- Game listing creation with platform, genre and monetization details
- Developer game list with submission and publication status
- Build-status screen that calls the authenticated Creator API when its base URL is configured
- Separate Android APK and iOS build profiles

## Secure boundaries

The mobile app uses only the public Supabase URL and publishable/anon key. Supabase Row Level Security is responsible for protecting studio and game records. Never bundle a service-role key, database password, payment secret or scanner secret in a mobile app.

Game build files are sensitive. The mobile app does not write to the private build metadata table or upload directly to the quarantine bucket. Build ingestion remains in the Creator server API, which checks the developer's session and studio ownership before issuing a private upload URL. The upload/scanning service must be configured before real build uploads can be enabled.

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

After the adult project owner links an Expo/EAS project and configures the required build credentials:

\`\`\`bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
\`\`\`

The preview profile creates an Android APK for internal testing. A physical iPhone install or App Store release requires the appropriate Apple signing and distribution account. The GitHub validation workflow exports the Android and iOS bundles and compiles a debug Android APK; it does not sign an iOS IPA.

Demo mode is for interface testing only. It does not create real developer accounts, studios or marketplace listings.