# File module

Contract-based `FileService` over the S3 provider: `requestUpload` issues a
presigned PUT and writes a `PENDING` row, `confirmUpload` HEAD-verifies the
object landed (existence + size) and flips it to `READY`, `getDownloadUrl`
returns a CloudFront signed URL when `CLOUDFRONT_ENABLED=true`, otherwise a
presigned S3 GET.

## Known gap: orphan sweep (deferred to v0.4)

Two situations currently leave orphaned state with nothing to clean them up:

- A client calls `POST /files/upload-request` and never PUTs to the presigned
  URL (or PUTs and never calls `confirm`) — the `File` row stays `PENDING`
  forever, and no S3 object exists (or one exists that the app never learns
  about).
- A client PUTs an object that is later rejected by `confirmUpload` (too
  large, or the presigned URL expires and a stale PUT lands) — the S3 object
  can end up orphaned with no corresponding `READY` row.

This is a known, explicit gap, not an oversight: v0.4 adds a task-scheduler
module, and the fix belongs there — a scheduled job (Redis-locked, per the
operational rules in `docs/conventions/backend.md`) that:

1. Deletes `File` rows in `PENDING` status older than the upload TTL window
   (`FILE_UPLOAD_TTL_SEC` plus a safety margin), and best-effort deletes the
   matching S3 object via `S3ProviderInterface.delete`.
2. Optionally reconciles S3 listing against `File` rows to catch objects that
   were PUT but never confirmed at all.

Until that job exists, disk/storage cost from abandoned uploads is bounded
only by client behavior (most clients confirm immediately after a successful
PUT) — acceptable for now, not for production scale.
