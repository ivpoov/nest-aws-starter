# File module

Contract-based `FileService` over the S3 provider: `requestUpload` issues a
presigned PUT and writes a `PENDING` row, `confirmUpload` HEAD-verifies the
object landed (existence + size) and flips it to `READY`, `getDownloadUrl`
returns a CloudFront signed URL when `CLOUDFRONT_ENABLED=true`, otherwise a
presigned S3 GET.

## Orphan sweep

`OrphanFileSweepJob` (`modules/file/jobs/`) closes the v0.3 gap described
above: `File` rows can end up `PENDING` forever when a client never PUTs to
the presigned URL, never calls `confirm`, or PUTs an object that
`confirmUpload` would have rejected.

Registered through the Task 2 scheduler (Redis-locked, per the operational
rules in `docs/conventions/backend.md`), it runs daily
(`FILE_SWEEP_CRON_EXPRESSION`, `0 3 * * *` — the 24h staleness threshold makes
a tighter cadence pointless) and, for every `PENDING` row older than
`FILE_SWEEP_STALE_THRESHOLD_MS` (24h), capped at `FILE_SWEEP_BATCH_LIMIT`
(200) rows per run so a large backlog can't push a single run past the job's
lock TTL:

1. `HeadObject`s the row's S3 key.
2. **Object absent** — the upload never landed (or landed and was later
   removed). Deletes the `File` row.
3. **Object present and valid** — the same content-type allowlist and size
   check `confirmUpload` applies (`FileService.isUploadedObjectValid`)
   passes. This is a missed `confirm` call, not an abandoned upload —
   reconciles the row to `READY` with the size/content-type S3 actually
   observed, and emits `FILE_UPLOADED_EVENT` exactly as `confirmUpload` does.
4. **Object present but invalid** (wrong content-type or over size) — never
   reconciled to `READY`: a type/size the upload flow would have rejected at
   `confirmUpload` time must not become downloadable just because the client
   abandoned the confirm step. Deletes the S3 object and the `File` row.

See `FileService.sweepOrphans()` / `tests/file.service.spec.ts` for the
per-outcome unit coverage and `test/maintenance-jobs.e2e-spec.ts` for the
end-to-end proof against real S3 (LocalStack/MinIO).
