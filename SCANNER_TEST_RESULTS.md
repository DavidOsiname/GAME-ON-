# MVP 0.6 scanner worker local test results

**Result: PASS — local mocked integration only.**

Command:

```bash
node scripts/test-build-scanner.mjs
```

Scenarios passed:

1. A ZIP-signature APK-like fixture streamed from a mock private Storage endpoint to a mock ClamAV `INSTREAM` TCP server; the worker computed SHA-256 and submitted a lease-bound `clean` callback.
2. A simulated ClamAV `FOUND` response was submitted as `rejected`.
3. A file whose contents did not match the declared APK type was rejected even when the mock ClamAV response was `OK`.

Assertions included the scanner webhook secret, build ID, UUID lease token, SHA-256 format and expected result. Test-only credentials are in-memory dummy values and no real secrets are included.

**Not tested by this suite:** actual ClamAV virus definitions/detection, EICAR against a real ClamAV daemon, real Supabase Auth/Storage/PostgREST, actual app callback deployment, Docker image startup, upload/download from physical devices, or production load/security. These remain release blockers.
