# Learning sync protocol

## Goals

- Typing never waits for the network.
- Retries are idempotent.
- A temporary Supabase failure does not lose local study history.
- Server-side ownership is enforced by Auth + RLS, not by trusting a client-supplied user id.

## Client lifecycle

1. Save the normal Qwerty record locally.
2. Append a `learningEvents` row with a client UUID and `syncState=pending`.
3. A sync worker reads pending rows in small batches (default 100).
4. Convert local field names to the remote envelope.
5. Call the authenticated `ingest_learning_events` RPC.
6. Only after acknowledgement, mark the corresponding local UUIDs as `synced`.
7. On failure, retain the events locally, increment the retry counter and store a short diagnostic.

## Idempotency

The server primary key is the client event UUID. `ingest_learning_events` uses `ON CONFLICT (id) DO NOTHING`. Replaying a batch after an uncertain network response is therefore safe.

## Authentication

The browser must use a Supabase publishable key and an authenticated user session. The RPC sets `user_id` from `auth.uid()`; the browser must not use `service_role`.

## Conflict model

Raw events do not merge: they are immutable facts. Derived state is regenerated from facts. This intentionally avoids two-device last-write-wins bugs for learning history.

## Failure recovery

A failed event stays on the device. The UI can later expose a small sync-status indicator, but sync errors must not interrupt the study session.
