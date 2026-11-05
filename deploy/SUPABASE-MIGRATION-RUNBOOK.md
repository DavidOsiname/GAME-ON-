# Supabase migration runbook — Game ON

This procedure is for the adult project owner or an authorised database operator. It applies the checked-in migrations to the hosted Supabase project; it is not needed for the local CI database, where all migrations already pass.

## Target and safety

The current Game ON Supabase project reference is `viwczhmthlyagqwcrgrt` in region `eu-central-1`. Before proceeding, the project owner must verify that this is the intended **staging** project. Do not run the procedure against production without an approved maintenance window, a current backup, and a tested recovery plan.

Never paste the database password, Supabase access token, service-role key, or secret key into chat, GitHub source, or a committed environment file. Authenticate locally with the Supabase CLI and let it prompt for credentials.

## 1. Get the reviewed branch

Use a trusted workstation and check out the reviewed Game ON branch:

```bash
git checkout import/game-on-mvp-0.9.10
git pull
```

Confirm that `supabase/migrations/0011_game_cover_artwork.sql` exists and inspect it before applying anything.

## 2. Authenticate and link the intended project

Install/update the Supabase CLI using the official instructions, then run:

```bash
supabase login
supabase link --project-ref viwczhmthlyagqwcrgrt
```

The CLI may prompt for the database password. The project owner should enter it locally; do not store it in the repository.

## 3. Compare migration history and preview

Run:

```bash
supabase migration list --remote
supabase db push --dry-run --remote
```

Stop and ask the project owner to review the difference if the remote history is not aligned with the checked-in migrations, or if the dry run proposes anything unexpected. For this artwork change, the expected pending migration is **only** `0011_game_cover_artwork.sql`, assuming migrations 0001–0010 are already applied remotely.

Do not use `supabase db reset --remote` on a hosted project. Do not use `--include-seed` on production.

## 4. Apply only after explicit approval

After the owner has reviewed the dry-run output and confirmed the target project and backup/recovery arrangements, run:

```bash
supabase db push --remote
```

The CLI records successfully applied migrations in the remote migration history. If it reports a migration-history mismatch, stop; do not edit `supabase_migrations.schema_migrations` or use `migration repair` as a guess.

## 5. Verify the result

Run:

```bash
supabase migration list --remote
```

Confirm that migration 0011 is marked applied. In the Supabase Dashboard, open **Storage** and verify that the `game-covers` bucket exists with public reads, a 5 MiB file limit, and JPEG, PNG, and WebP MIME types.

The migration adds owner-scoped INSERT, UPDATE, and DELETE policies for cover objects under the path `<studio-uuid>/<game-uuid>/cover.<extension>`. Cover artwork is public catalogue media; executable builds stay in the separate private `game-build-quarantine` bucket.

## 6. End-to-end test after deployment

1. Sign in to Creator with a real developer account that owns a studio.
2. Submit a draft game with a JPEG, PNG, or WebP cover image under 5 MiB.
3. Confirm the Creator listing shows the uploaded cover.
4. Confirm the published Store listing displays the cover.
5. Confirm another developer account cannot replace or delete the first studio's cover.
6. Confirm executable builds remain private and still use the existing quarantine/scanning flow.

A passing database migration or CI test does not by itself prove the remote upload flow works. Keep payments disabled and do not treat the app as production-ready until the remaining deployment, security, moderation, backup, and release checks have been completed.

## Official reference

See the Supabase guide for [running commands against local and hosted projects](https://supabase.com/docs/guides/local-development/local-and-hosted-projects) and the [Supabase CLI reference](https://supabase.com/docs/reference/cli/v1/supabase-init).
