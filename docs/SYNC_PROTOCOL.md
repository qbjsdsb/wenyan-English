# Learning sync protocol

## Goals

- Typing never waits for the network.
- Retries are idempotent and rate-limited.
- A temporary Supabase failure does not lose local study history.
- A local browser account switch must never route another account's pending events into the current account.
- Server-side ownership is enforced by Auth + RLS, not by trusting client-supplied ownership metadata.

## Client lifecycle

1. Save the normal Qwerty record locally.
2. Append a `learningEvents` row with a client UUID and `syncState=pending`.
3. If the browser currently has a known Wenyan account, the event also stores `ownerUserId` as a local routing guard. This is not an authorization claim.
4. Events created without a known account remain unclaimed. Wenyan does not auto-upload them after a later login; the user must explicitly claim them from the Sync page.
5. A sync worker authenticates the current Supabase user, then reads only events whose `ownerUserId` matches that user.
6. Send ready rows in small batches (default 100) through the authenticated `ingest_learning_events` RPC.
7. Only after acknowledgement, mark the corresponding local UUIDs as `synced`.
8. On failure, retain the events locally, increment the retry counter, store a short diagnostic, and set `nextSyncAttemptAt` using exponential backoff.

## Local account isolation

`ownerUserId` exists to prevent accidental cross-account upload from one browser profile. It never replaces server authorization.

- New events inherit the locally authenticated owner marker when available.
- Signing out clears the current local owner marker; later offline events remain unclaimed.
- Signing into another account does not rewrite pending events already owned by the previous account.
- Unclaimed pending/failed events can be explicitly claimed to the currently authenticated account from the Sync page.
- Already-synced history is not silently reassigned.

## Retry policy

Failed events are not reset to pending every 30 seconds. The first retry waits about 30 seconds and subsequent failures back off exponentially up to roughly 15 minutes. Reconnecting to the network triggers a new sync check, but an event still respects its stored `nextSyncAttemptAt`.

This prevents a persistent outage or permission error from creating an endless tight retry loop while keeping the queue recoverable.

## Idempotency

The server primary key is the client event UUID. `ingest_learning_events` uses `ON CONFLICT (id) DO NOTHING`. Replaying a batch after an uncertain network response is therefore safe.

## Authentication

The browser uses only a Supabase publishable key and an authenticated user session. Before selecting an owner-specific batch, the sync path calls Supabase Auth to resolve the current user. The RPC still sets `user_id` from `auth.uid()`; the browser never supplies the authoritative server owner and must not use `service_role`.

## Conflict model

Raw events do not merge: they are immutable facts. Derived state is regenerated from facts. This intentionally avoids two-device last-write-wins bugs for learning history.

## Failure recovery

A failed event stays on the device with its attempt count and next retry time. Storage or network failures must not interrupt the study session. Cross-device download/restore is a separate P1 deliverable and must not be inferred from successful upload.
