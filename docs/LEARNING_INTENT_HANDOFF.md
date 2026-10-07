# Learning Intent v1 Handoff

Branch: `feature/learning-intent-v1`

## Implemented

- Versioned `ongoing`, `day`, `session` future-learning intent scopes.
- SECURITY INVOKER RPCs: `get_learning_intents`, `revise_learning_intent`, `clear_learning_intent`.
- Explicit RLS + Data API grants.
- OAuth mutation gating through existing `coach:auto_adjust` capability.
- Optimistic revisions, idempotency receipts and same-scope advisory locking.
- Strict bounded JSON contract for planner-facing constraints, goals and rationale.
- `FOUND` correctness fix for PL/pgSQL row lookup.
- Covering FK index for intent revisions.

## Production state

Migrations through `learning_intent_fk_index` have already been applied to the production Supabase project. No Learning Intent rows currently exist.

## Verification completed

- Migration history confirmed.
- `revise_learning_intent` / `clear_learning_intent` are SECURITY INVOKER.
- RLS is enabled on all three public Learning Intent tables.
- authenticated grants and anon restrictions verified.
- Production function definition verified so the write marker now precedes the row lookup that controls `FOUND`.
- No new Learning Intent Security Advisor WARN observed.

## Verification still required

A full mutation smoke test using a genuine user OAuth JWT is still required. The current automation environment correctly blocks synthetic JWT impersonation. Run the real end-to-end check after MCP exposes the tools:

1. read current intents;
2. create a short-lived `session` intent with `expectedRevision=0`;
3. retry the identical requestId and verify idempotent response;
4. revise with `expectedRevision=1`;
5. verify invalid constraints are rejected;
6. clear with the current revision;
7. confirm the scope no longer affects Smart Session.

Do not leave a test intent active after verification.

## Next coding task

Upgrade `wenyan-english-mcp` with semantic tools for Learning Intent, then make Smart Session consume active scopes as:

`session > day > ongoing > local defaults`

Cloud failure must not prevent local study.
