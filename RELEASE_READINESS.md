# GAME ON — release readiness tracker

**Scope:** Android releases of GAME ON STORE and GAME ON CREATOR  
**Last reviewed:** 5 November 2026  
**Source branch:** `import/game-on-mvp-0.9.10`  
**Publication status:** Not production-ready; no production-signed release artifact has been created.

This is the working release checklist. Mark an item complete only after the evidence named in the item has been checked. A green GitHub workflow is evidence about that commit in CI; it is not evidence that production services are deployed or that the apps have passed real-device testing.

## 1. Mobile source and build stability

- [x] Keep STORE and CREATOR as separate mobile applications and Android package IDs.
- [x] Implement the Store catalogue/player account foundations and Creator studio/listing foundations.
- [x] Implement Creator listing edits and owner-checked rejected-listing resubmission.
- [x] Implement Creator cover-image upload and Store cover rendering in source.
- [x] Implement safe cover replacement: upload a versioned object, update the game row, then best-effort remove only the prior object belonging to that same game/studio.
- [x] Add the versioned cover path to migration 0011 and update the pgTAP test plan to 31 assertions.
- [x] Add static checks for the cover replacement order and the two apps' EAS build profiles.
- [x] Configure separate EAS profiles for internal APK, production-signed direct-install APK and Play AAB.
- [x] Configure EAS build environments explicitly: `preview` for preview builds and `production` for both production profiles.
- [x] Obtain a green CI validation run on branch HEAD `0d52652` after the release-profile/environment changes.
- [x] Obtain green latest mobile build workflows for both apps on branch HEAD `0d52652`; both debug APK artifacts were uploaded.

**Evidence:** [Full validation run](https://github.com/DavidOsiname/GAME-ON-/actions/runs/42013857582), [CREATOR debug APK build](https://github.com/DavidOsiname/GAME-ON-/actions/runs/42013857513), and [STORE debug APK build](https://github.com/DavidOsiname/GAME-ON-/actions/runs/42013857698). All three passed on source commit `0d52652`. Debug artifact downloads are retained through 19 November 2026.

## 2. Staging backend and hosted services — adult owner/operator

- [ ] Create/confirm a dedicated Supabase staging project and verify its region and project ref.
- [ ] Review migration history and confirm migration 0011 is the only outstanding migration before applying it.
- [ ] Apply migration 0011 to staging only after the authorised owner approves the dry run and backup.
- [ ] Verify the public `game-covers` bucket, the 5 MiB/MIME restrictions and owner-only storage policies on staging.
- [ ] Deploy the separate Store and Creator web services behind HTTPS.
- [ ] Configure Supabase Auth redirect URLs for both HTTPS domains.
- [ ] Deploy the private game-build scanner and verify ClamAV remains on a private network.
- [ ] Configure the Creator API HTTPS origin in the Creator EAS production environment.
- [ ] Test backend readiness, backup/restore and monitoring.
- [ ] Keep all service-role, database, Paystack and scanner secrets in server-side secret storage only.

**Operator guides:** [Supabase migration runbook](deploy/SUPABASE-MIGRATION-RUNBOOK.md), [self-host deployment guide](deploy/README.md), and [Android release/signing runbook](deploy/ANDROID-RELEASE-RUNBOOK.md).

**Current known blockers:** migration 0011 has not been applied to the live Supabase project; the Creator API and scanner deployment have not been confirmed. Do not use `supabase db reset --remote`.

## 3. Complete advertised player and developer journeys

- [ ] Test real sign-up, email confirmation, sign-in, sign-out and password recovery on physical Android devices.
- [ ] Replace or clearly separate Store sample catalogue data from the live approved-game catalogue.
- [ ] Test live published listing reads, artwork and listing details from the staging backend.
- [ ] Test Creator account, studio ownership, studio verification and game-submission lifecycle.
- [ ] Test Game ON reviewer approval/rejection and Creator resubmission.
- [ ] Test that a developer cannot edit another studio's listing or access its private builds.
- [ ] Complete private game-build upload, malware scanning and release approval before enabling downloads.
- [ ] Complete and test Store checkout, order verification, purchase history, refunds and entitlement delivery before advertising paid purchases in the Android app.
- [ ] Verify that purchases, downloads and refunds are not shown as available until their full native workflows are enabled.
- [ ] Run security, crash, poor-network, accessibility and data-loss tests.

**Known mobile-scope limitation:** the Store README describes its current catalogue as fictional sample data and says checkout, refunds, executable delivery, ratings and push notifications are not enabled in the native milestone. Do not advertise these as working native-app features until their end-to-end implementation and staging tests are complete. Payments remain disabled by default.

## 4. Android app identity, branding and Play listing materials

| Item | STORE | CREATOR |
|---|---|---|
| Android application ID | `com.gameon.store` | `com.gameon.creator` |
| Current version | `0.1.0` | `0.1.0` |
| Current Android version code | `1` | `1` |
| Dedicated app icon asset | [ ] | [ ] |
| Splash/launch artwork | [ ] | [ ] |
| Privacy policy URL | [ ] | [ ] |
| Terms/support contact | [ ] | [ ] |
| Store screenshots and listing copy | [ ] | [ ] |

- [ ] Approve final app icon, adaptive icon and splash artwork for each app.
- [ ] Add optimised Android icon/splash assets and verify on multiple screen sizes.
- [ ] Publish a truthful privacy policy and terms/support page on stable HTTPS URLs.
- [ ] Confirm the legal publisher name, privacy contact and support email with the adult/business owner; do not publish placeholder contacts.
- [ ] Prepare Play listing title, short description, full description, phone screenshots and any required feature graphic.
- [ ] Complete Play Console Data safety, target audience, content rating and app-access declarations from the actual shipped behavior.
- [ ] Review app permissions and remove any that are not needed.

**Current known gaps:** dedicated mobile app icon/splash assets and public privacy/terms URLs have not been confirmed in the repository. The legal owner must review policy wording and supply valid publisher/contact details before publication.

## 5. EAS projects, environment and Android signing — adult owner

Do this separately from `mobile/store` and `mobile/creator`; do not combine their EAS project IDs or signing credentials.

- [ ] Adult owner signs in to Expo and runs `npx eas-cli init` inside each mobile app directory.
- [ ] Repository owner creates the protected GitHub environment `game-on-android-release`, adds at least one adult required reviewer, and stores the adult-owned Expo access token as the environment secret `EXPO_TOKEN`.
- [ ] Confirm each app has its own `extra.eas.projectId` and correct `owner` in its app config.
- [ ] Configure the Store EAS `production` environment with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Configure the Creator EAS `production` environment with those same public client values plus `EXPO_PUBLIC_CREATOR_API_URL` after deployment.
- [ ] Configure preview environment values separately if preview builds need a non-production backend.
- [ ] Generate or select the Android signing/upload keystore for each EAS project.
- [ ] Verify signing certificate fingerprints and securely back up each keystore and recovery information under adult-owner control.
- [ ] Never commit signing credentials or put service-role/database/payment/scanner secrets into any `EXPO_PUBLIC_` variable.

Follow the [Android release runbook](deploy/ANDROID-RELEASE-RUNBOOK.md) for the exact setup commands, environment protection and signature-verification procedure. Do not post tokens, keystore files or passwords in chat or source control. The manual [Android release workflow](.github/workflows/android-release.yml) requires the protected environment, linked project IDs, production EAS variables and preconfigured remote signing credentials; it builds only and never submits to Google Play.

## 6. Signed Android release builds

For **each** application:

- [ ] Build a signed Release APK with EAS profile `production-apk` for direct installation.
- [ ] Build a Google Play Android App Bundle (AAB) with EAS profile `production`.
- [ ] Verify the APK signature with Android build tools (`apksigner verify --verbose --print-certs`).
- [ ] Verify package ID, version/versionCode, target SDK, app icon and production backend values.
- [ ] Confirm neither artifact uses demo-only data or points at the wrong project.
- [ ] Archive the exact source commit, build ID, signing certificate fingerprint and final files.

The GitHub mobile workflows compile **debug APKs** for automated checks. A debug APK is not the production Release APK. Latest debug artifacts for both apps were built successfully on 5 November 2026; these are for device testing and are not production signing. The manual EAS release workflow has been added, but the EAS `production-apk` and `production` profiles have not yet been run because each adult-owned Expo project, environment and signing credential set still needs setup.

## 7. Real-device release acceptance

- [ ] Install the exact production-signed APK on a clean Android device.
- [ ] Test fresh installation, update installation, sign-in, account recovery and app relaunch.
- [ ] Test every advertised Store and Creator workflow against staging.
- [ ] Check that data is isolated by account/studio and that server review decisions remain server-controlled.
- [ ] Test on supported Android versions, screen sizes and slow/unreliable networks.
- [ ] Inspect crash reports, startup performance, accessibility and permission prompts.
- [ ] Fix all release-blocking issues and repeat the build and tests.

## 8. Google Play publication — adult publisher account owner

- [ ] Confirm an adult-owned Google Play developer account and complete any account verification requirements.
- [ ] Create two independent Play Console app records, one for STORE and one for CREATOR.
- [ ] Configure Play App Signing for each application.
- [ ] Upload each signed AAB to internal testing first.
- [ ] Add testers, gather feedback and complete any testing requirement applicable to the account.
- [ ] Resolve Play Console policy, content-rating, data-safety and app-access issues.
- [ ] Submit each app for review.
- [ ] Publish only after approval and a final release-owner sign-off.
- [ ] Monitor crashes, reviews and support after release.

Do not automatically submit to Play or roll out to production without the adult publisher's explicit approval.

## Release status summary

| Release gate | Status |
|---|---|
| Core mobile source features | Implemented in code |
| Latest branch CI validation | Passed on `0d52652` |
| Staging backend and Creator API | Not deployed/verified |
| Complete native marketplace journeys | Incomplete |
| Icons, privacy policy and Play listing assets | Not ready |
| EAS project IDs and production variables | Adult owner setup required |
| Production Android signing | Not configured/verified |
| Production Release APK and Play AAB | Not built |
| Real-device acceptance | Not started |
| Google Play review/publication | Not started |

**Definition of done:** STORE and CREATOR each have a verified signed Release APK, a Play-ready signed AAB, completed staging workflows, valid policy/listing materials, a passing real-device acceptance record and an approved Play Console release. A green source-code CI run alone does not meet this definition.
