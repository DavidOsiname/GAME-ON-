# Game ON quarantined build scanner

This is a separate Node.js worker intended to run beside ClamAV on a private server/network. It is not part of either public-facing app. It watches the private Supabase `game-build-quarantine` bucket through the service-role REST/Storage APIs, streams each uploaded object to ClamAV using `INSTREAM`, calculates SHA-256, performs a basic platform/file-signature check, then reports the result to Game ON Creator's secret-authenticated callback.

## Important security boundaries

- Keep this worker on a private network. The ClamAV TCP port 3310 must not be exposed publicly. The official ClamAV Docker documentation describes the TCP daemon and its container deployment options: https://docs.clamav.net/manual/Installing/Docker.html
- Keep the Supabase service-role key and scanner webhook secret only in the worker's server-side `.env`; never add them to either app's `NEXT_PUBLIC_` variables or browser code.
- The worker downloads only from the private quarantine bucket and does not publish files or issue player download URLs.
- A clean ClamAV result is only one release check. Game ON administrator approval is still required before a build can be distributed.
- ClamAV is signature-based malware detection, not a guarantee that a file is safe. Keep moderation, platform signing checks, abuse reporting and independent security review in place.
- The initial upload cap is 50 MiB. ClamAV's `INSTREAM` framing uses 4-byte big-endian chunk lengths and a zero-length terminator. Its `StreamMaxLength` must be configured above 50 MiB; also keep `MaxFileSize` above 50 MiB and choose a prudent archive `MaxScanSize`. See https://docs.clamav.net/manual/Usage/ClamdProtocol.html and the official clamd.conf reference.

## Configure

1. Apply Supabase migrations `0001` through `0006` in numeric order.
2. In Creator's production environment, set `GAMEON_SCANNER_WEBHOOK_SECRET` to a strong random secret.
3. Copy `.env.example` to `.env` in this directory.
4. Set `SUPABASE_URL`, the server-only `SUPABASE_SERVICE_ROLE_KEY`, `GAMEON_CREATOR_BASE_URL` and exactly the same scanner webhook secret used by Creator.
5. Confirm the ClamAV daemon configuration has at least:

   ```conf
   StreamMaxLength 60M
   MaxFileSize 60M
   MaxScanSize 150M
   ```

   `StreamMaxLength` is the limit on the bytes sent over the scanner protocol. `MaxScanSize` includes content expanded from archives, so tune this carefully; don't disable archive scan limits. Check the effective configuration for the exact image/version before accepting production uploads.

6. Start the private scanner stack:

   ```bash
   docker compose up -d --build
   docker compose logs -f build-scanner
   ```

The ClamAV image downloads/updates its signature database. The worker retries the queue poll while ClamAV starts. Keep persistent storage for the signature database as configured in `compose.yaml`. ClamAV documentation currently recommends at least 3 GiB RAM and prefers 4 GiB; budget the scanner host accordingly and monitor memory during daily signature reloads.

## Worker behavior

- Polls only `upload_status=uploaded` and `scan_status=quarantined` rows.
- Claims each build atomically by setting `scan_status=scanning`, a time-limited lease token and attempt counter.
- Reclaims stale `scanning` jobs after `SCANNER_STALE_AFTER_MS`; an old worker cannot submit results after its lease is replaced.
- Streams private objects to ClamAV, hashes the exact bytes and checks basic file magic for Android ZIP packages, ZIP files, Windows EXE and MSI.
- Calls `POST /api/internal/build-scan` with `buildId`, `workerId`, `result`, `sha256` and a report.
- Operational failures set the scan state to `failed`. An administrator can use Creator `/admin` to retry a failed scan; the build remains unavailable to players meanwhile.

## Operational requirements before production

- Use a dedicated VM/container host with restricted access, encrypted disks and outbound network rules only to Supabase, Creator HTTPS and ClamAV signature-update endpoints.
- Monitor queue depth, scanner failure rate, signature database freshness, CPU/RAM and disk usage.
- Patch/pin the ClamAV image to a tested release rather than relying indefinitely on `stable`.
- Test with EICAR test files in a non-production project, benign files for every accepted format, malformed archives, oversized files, network interruptions and expired worker leases.
- Add a signed artifact pipeline / platform-specific code-signature verification before broad distribution.

This worker package is source code and deployment configuration; it is not running until an operator deploys it with real secrets and a reachable Supabase staging/production project.
