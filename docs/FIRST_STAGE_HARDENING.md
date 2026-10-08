# First-stage hardening

Branch: `sol/first-stage-hardening`

Baseline: `main` at `48090e3c8cad7529d1794c35e8ff187480a355b1` (PR #49 merged and Pages deployed).

This continuation deliberately does **not** start FSRS or Literature. It closes reliability gaps left after the Astra semantic-recall release.

## Scope

1. Backup import staging validation before any destructive restore.
2. Reading draft owner isolation and account-switch safeguards.
3. Per-device executor availability so Agent reasoning can match the target Wenyan device.
4. Reconcile repository/plugin metadata with the deployed MCP v14 contract where an actual durable artifact exists.
5. Real-user Semantic Recall → sync → MCP reread remains a user-initiated acceptance step; no synthetic personal facts will be created.

## Checkpoint 1

Implemented isolated backup staging validation:

- reject oversized compressed/decompressed inputs before touching `RecordDB`;
- inspect Dexie export metadata and reject wrong database, unsupported future versions, unknown/duplicate tables, invalid row counts, or missing base tables;
- import the complete backup into a temporary IndexedDB and verify table row counts;
- only after staging succeeds can the existing atomic destructive restore run;
- temporary staging DB is deleted after validation.

This protects existing learning data from malformed, truncated, wrong-app, or future-schema backup files before `clearTablesBeforeImport` is reached.

## Invariants

- Historical learning facts are not rewritten by AI.
- Owner isolation must not regress.
- Command completion is not learning completion.
- No permissive RLS or widened OAuth authority just to simplify Agent control.
- Production migration history gaps are reconciled deliberately; old DDL is never replayed blindly.
