# GAME ON Android release runbook

**Audience:** adult project owner / authorised release operator  
**Apps:** GAME ON STORE and GAME ON CREATOR  
**Last reviewed:** 5 November 2026

This runbook prepares and builds the two signed Android release artifacts. It does not activate payments, apply live database migrations, upload to Google Play, or publish a production rollout.

## 0. Release safety rules

- Keep STORE and CREATOR as two separate Expo/EAS projects, with separate project IDs and Android package names.
- Use an adult-owned Expo account and an adult-owned Google Play developer account.
- Never paste an Expo token, keystore, keystore password, service-role key, database password, payment secret or scanner secret into chat or source control.
- Prefer Expo-managed remote Android credentials. Back up signing information securely under the adult owner's control.
- The GitHub workflow uses `--freeze-credentials`: it will not generate, replace or update signing credentials during a release build. Credentials must already exist.
- The workflow only builds. It does not run `eas submit`, upload to Play, or release to production.
- Do not build a public release from the feature branch. Review the pull request, complete staging and device acceptance, and use the approved `main` branch for an actual release.

## 1. Create and link the two EAS projects

On a computer with Node.js 22 or newer and npm installed, sign in using the adult owner's Expo account. Repeat the procedure separately in each app directory.

### STORE

```bash
cd mobile/store
npx --yes eas-cli@27.4.1 login
npx --yes eas-cli@27.4.1 whoami
npx --yes eas-cli@27.4.1 init
```

### CREATOR

```bash
cd mobile/creator
npx --yes eas-cli@27.4.1 login
npx --yes eas-cli@27.4.1 whoami
npx --yes eas-cli@27.4.1 init
```

During `eas init`, create or link the correct project owned by the adult account. Do not link both apps to the same EAS project. Confirm each app's `app.json` contains its own unique `expo.extra.eas.projectId`. Set `expo.owner` to the correct adult-owned Expo account username so the owner is explicit.

Expected Android/iOS application IDs:

| App | Android package | iOS bundle ID |
|---|---|---|
| STORE | `com.gameon.store` | `com.gameon.store` |
| CREATOR | `com.gameon.creator` | `com.gameon.creator` |

The protected GitHub build checks the project ID and package ID before it starts an EAS build.

## 2. Configure EAS production environment variables

EAS cloud builds use variables stored in the Expo project. They do not automatically inherit GitHub Actions secrets. Configure the variables in the correct app directory so each command applies to that app's EAS project.

### STORE

Run from `mobile/store`:

```bash
npx --yes eas-cli@27.4.1 env:set production --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT.supabase.co" --visibility plaintext
npx --yes eas-cli@27.4.1 env:set production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY" --visibility plaintext
```

### CREATOR

Run from `mobile/creator`:

```bash
npx --yes eas-cli@27.4.1 env:set production --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT.supabase.co" --visibility plaintext
npx --yes eas-cli@27.4.1 env:set production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY" --visibility plaintext
npx --yes eas-cli@27.4.1 env:set production --name EXPO_PUBLIC_CREATOR_API_URL --value "https://YOUR-CREATOR-DOMAIN" --visibility plaintext
```

Only set the Creator API URL after its HTTPS deployment and readiness check succeed. Use the real project URL and public publishable/anon key from the adult project owner. These are client values and will be embedded in the app; they are not server secrets.

Never configure any of the following as an `EXPO_PUBLIC_` variable: Supabase secret/service-role key, database password, Paystack secret, scanner webhook secret, or other server credential. Payments remain disabled until their separate merchant/compliance and staging verification gates are complete.

If preview builds use a dedicated staging backend, configure corresponding `preview` environment values in each independent EAS project as well.

## 3. Prepare remote Android signing credentials

Do this separately from `mobile/store` and `mobile/creator` after each project is linked.

```bash
npx --yes eas-cli@27.4.1 credentials --platform android
```

Use the EAS credentials manager to create or select the Android application keystore for the correct app. Store the credential backup and its recovery details securely under adult-owner control. Record the signing certificate fingerprint for the release register. Do not commit the keystore or credentials JSON to Git.

The GitHub workflow passes `--freeze-credentials`. That is intentional: the automated release job can use configured credentials, but cannot silently create, replace or rotate them. If credentials are missing, stop and have the authorised owner configure them before retrying.

## 4. Protect the GitHub release workflow

A repository owner must configure this before the manual workflow is used:

1. Open GitHub repository **Settings → Environments**.
2. Create the environment named exactly `game-on-android-release`.
3. Add at least one adult project/release owner as a required reviewer. Enable prevention of self-review where available.
4. Add an environment secret named `EXPO_TOKEN` containing an Expo access token created by the adult owner. Never use an Expo account password.
5. Restrict deployment branches to the approved release branch. For public production releases, use `main` after the feature branch has been reviewed and merged.
6. Keep repository permissions for the workflow read-only.

The environment approval gate is separate from the app signing credentials. The environment secret lets GitHub authenticate to Expo; the remote EAS Android keystore signs the Android binary.

## 5. Build a production-signed APK or Play AAB

Once all previous sections are complete and the latest CI, staging and device gates are green:

1. Open **Actions → GAME ON Android release build**.
2. Select the approved release branch (normally `main`).
3. Choose `store` or `creator`.
4. Choose one profile:
   - `production-apk`: signed Release APK for direct installation.
   - `production`: signed Android App Bundle (AAB) for Google Play.
5. Start the workflow and have the required adult reviewer approve the protected environment deployment.
6. Review the EAS build output in the GitHub Actions job and the corresponding Expo project's build history. Confirm it completed successfully and download the artifact from Expo.

Run each app/profile as a distinct build. This workflow does not publish to Google Play.

## 6. Verify the exact release artifact

Download the artifact from Expo and verify it before distributing it.

For a Release APK, install Android SDK Build Tools on the verification computer and run:

```bash
apksigner verify --verbose --print-certs GAME-ON-APP-release.apk
```

Confirm the package identity, version/versionCode, target SDK, and SHA-256 certificate fingerprint. The same app must continue to use its original signing identity for future updates.

For an AAB, use Java's signing verification:

```bash
jarsigner -verify -verbose -certs GAME-ON-APP-release.aab
```

Retain the source commit, EAS build ID, artifact hash, package ID, version/versionCode, signing certificate fingerprint, and verification output in the release record. A successful EAS job is not a substitute for inspecting and testing the exact binary.

## 7. Google Play handoff (adult publisher only)

Google Play uses Play App Signing for the installed APKs delivered to users. The uploaded AAB is signed with the app's upload key; the Play Console enrollment and app-signing setup must be completed separately for each application.

The adult publisher should:

- Create separate STORE and CREATOR app records in Play Console.
- Complete Play App Signing setup independently for both package IDs.
- Upload each verified AAB to internal testing first.
- Complete store-listing, privacy, Data safety, age-rating, target-audience and app-access declarations truthfully for the shipped version.
- Complete applicable tester/account requirements and resolve Play review warnings.
- Submit for review only after the adult publisher approves.
- Start a production rollout only after approval and final release sign-off.

Do not add Play service-account JSON, upload keys, or other signing materials to this repository. Do not use an automatic Play submission workflow for this project until the adult publisher explicitly authorises one.

## 8. Current external blockers

The repository cannot complete the signed build by itself until the adult owner has supplied and configured:

- Two unique EAS projects and project IDs.
- Correct adult-owned Expo account ownership.
- Production EAS environment variables for each app.
- Android remote signing credentials and secure backups for each app.
- GitHub's protected `game-on-android-release` environment and `EXPO_TOKEN` secret.
- The deployed Creator HTTPS API origin before Creator release builds are treated as operational.

The repository's latest GitHub debug APK artifacts are test builds, not production Release APKs. Never label a debug APK as a production-signed deliverable.
