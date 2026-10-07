# Learning sync protocol

## Goals

- Typing never waits for the network.
- Upload and download are idempotent and rate-limited.
- A temporary Supabase failure does not lose local study history.
- A local browser account switch must never route another account's pending events into the current account.
- Server-side ownership is enforced by Auth + RLS, not by trusting client-supplied ownership metadata.
- A second browser can restore immutable Wenyan learning facts without reconstructing or mutating legacy Qwerty records.

## Upload lifecycle

1. Save the normal Qwerty record locally.
2. Append a `learningEvents` row with a client UUID and `syncState=pending`.
3. If the browser currently has a known Wenyan account, the event also stores `ownerUserId` as a local routing guard. This is not an authorization claim.
4. Events created without a known account remain unclaimed. Wenyan does not auto-upload them after a later login; the user must explicitly claim them from the Sync page.
5. A sync worker authenticates the current Supabase user, then reads only events whose `ownerUserId` matches that user.
6. Send ready rows in small batches (default 100) through the authenticated `ingest_learning_events` RPC.
7. Only after acknowledgement, mark the corresponding local UUIDs as `synced`.
8. On failure, retain the events locally, increment the retry counter, store a short diagnostic, and set `nextSyncAttemptAt` using exponential backoff.

## Download / restore lifecycle

Cloud restore uses the authenticated, `SECURITY INVOKER` RPC `pull_learning_events`. RLS remains active, and the function only returns rows whose server-owned `user_id` equals `auth.uid()`.

1. Resolve the authenticated Supabase user.
2. Read that user's local `learningSyncCursors` row, if one exists.
3. Request a page ordered by `(created_at, id)` after the stored cursor. `created_at` is the server receive timestamp, so the cursor does not depend on a client clock.
4. Validate the source/version/event type and payload shape before accepting remote rows.
5. In one local Dexie transaction, reconcile rows by their stable UUID and advance the cursor to the last server row.
6. A duplicate UUID for the same account is idempotently reconciled as `synced`; a UUID already owned locally by a different account aborts the whole page and does not advance the cursor.
7. Unknown future event/source versions also stop the page before cursor advancement so an old client cannot silently skip facts it does not understand.
8. Background sync and the Sync page both perform upload + restore. Multiple pages can be pulled per run; later runs continue from the per-account cursor.

The server index `(user_id, created_at, id)` supports this deterministic cursor order.

## What restore means today

Current restore covers **Wenyan immutable learning facts in `learningEvents`**. Those facts are enough for Today summaries and future fact-derived analytics.

It does **not** yet mean a new computer is an exact clone of the old one. The following remain separate P1 work:

- current dictionary / current chapter / view preferences and other mutable UI state;
- legacy Qwerty `wordRecords`, `chapterRecords`, and `reviewRecords`;
- local study plans, until the plan schema receives its own cloud persistence;
- derived word mastery / review scheduling state that should eventually be recomputed from facts rather than treated as source truth.

Do not synthesize old Qwerty rows from remote facts merely to make the old UI look populated unless a reviewed, deterministic migration is introduced later.

## Local account isolation

`ownerUserId` exists to prevent accidental cross-account upload from one browser profile. It never replaces server authorization.

- New events inherit the locally authenticated owner marker when available.
- Signing out clears the current local owner marker; later offline events remain unclaimed.
- Signing into another account does not rewrite pending events already owned by the previous account.
- Unclaimed pending/failed events can be explicitly claimed to the currently authenticated account from the Sync page.
- Already-synced history is not silently reassigned.
- Download cursors are keyed by user ID, so one account's restore position cannot advance another account's cursor.

## Retry policy

Failed upload events are not reset to pending every 30 seconds. The first retry waits about 30 seconds and subsequent failures back off exponentially up to roughly 15 minutes. Reconnecting to the network triggers a new sync check, but an event still respects its stored `nextSyncAttemptAt`.

This prevents a persistent outage or permission error from creating an endless tight retry loop while keeping the queue recoverable. Download failure does not advance its cursor; a later run retries from the last committed page.

## Idempotency

The server primary key is the client event UUID. `ingest_learning_events` uses `ON CONFLICT (id) DO NOTHING`. Replaying a batch after an uncertain network response is therefore safe.

The local `learningEvents` table also uses the event UUID as its primary key. Cloud restore uses `bulkPut` only after account/source validation, so replaying an already-restored page does not create duplicate facts.

## Authentication

The browser uses only a Supabase publishable key and an authenticated user session. Before selecting an owner-specific upload batch or restoring cloud rows, the sync path calls Supabase Auth to resolve the current user. The ingest RPC sets `user_id` from `auth.uid()`; the pull RPC is `SECURITY INVOKER` and is additionally constrained by the table RLS policy. The browser never supplies the authoritative server owner and must not use `service_role`.

## Conflict model

Raw events do not merge: they are immutable facts. Derived state is regenerated from facts. This intentionally avoids two-device last-write-wins bugs for learning history.

Mutable state and plans require separate revision/conflict rules; they must not be smuggled into this immutable event protocol.

## Failure recovery

A failed upload event stays on the device with its attempt count and next retry time. A failed download page leaves both local rows and its cursor at the previous committed point. Storage or network failures must not interrupt the study session.
