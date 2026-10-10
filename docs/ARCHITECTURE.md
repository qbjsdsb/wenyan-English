# Wenyan English architecture

更新：2026-10-10。

## Product boundary

Wenyan English separates three product responsibilities:

- **Learning UI** — Qwerty-derived typing, direct semantic practice, review and error-book experience.
- **Learning memory** — local Dexie first, Supabase as durable cross-device history and derived state.
- **Learning intelligence** — ChatGPT / MCP reads explicit tools and RPCs instead of receiving raw database access.

Inside that boundary, future learning is intentionally split into five different concepts rather than one universal “plan” object:

1. **Immutable Learning Fact** — what actually happened. Website/runtime is authoritative.
2. **Derived Evidence / Coaching Context** — reproducible interpretation of facts with coverage and uncertainty.
3. **Learning Intent** — bounded future strategy such as minutes, review preference, new-word ceiling and preferred activity.
4. **Smart Session** — deterministic, disposable answer to “what should I do next right now?”.
5. **Cloud Plan / Command** — explicit persistent commitments and bounded UI actions. A command receipt is never learning completion.

Core invariant:

> AI controls future intent, never past truth.

## Main daily loop

```text
Real study action
      |
      v
Immutable Learning Facts
      |
      v
Derived Evidence / Coaching Context
      |
      v
ChatGPT reasoning
      |
      v
Bounded Learning Intent
      |
      v
Deterministic Smart Session
      |
      v
Local execution
      |
      +--------------------> new Learning Facts
```

This is the default daily path. Cloud Plan sits beside it as an **explicit commitment lane**, not above it as a second scheduler.

Use Learning Intent for “today 30 minutes / review first / no more than 5 new words / prefer semantic recall”. Use Cloud Plan only when the task itself needs durable identity, due date, completion evidence or cross-device tracking.

## Data flow

```text
Keyboard / study action
        |
        v
Qwerty / Wenyan learning UI
        |
        +----> existing Dexie records
        |
        +----> append-only Learning Events
                     |
                     v
               local sync queue
                     |
              authenticated sync
                     |
                     v
                 Supabase
             /             \
      learning_events     RPC/views
                               |
                               v
                         MCP / ChatGPT
```

## Local-first invariants

1. A network failure must never block ordinary typing or truthful local chapter completion.
2. Existing Qwerty records remain valid while the durable event model evolves.
3. Every remotely synced event has a stable client-generated UUID so retries are idempotent.
4. Raw learning events are append-only on the server.
5. Derived evidence and recommendations may be recalculated without rewriting history.
6. If cloud task identity cannot be proven, local study may continue but must not synthesize Cloud Plan completion.

## Cloud Plan execution integrity

Cloud Plan is a narrow explicit-task layer. The current executable contract is **chapter only**; database enum values reserved in earlier migrations are not product capabilities.

A new Cloud Plan task run captures:

- owner identity;
- plan revision observed at launch;
- a stable task execution fingerprint.

For the current chapter executor, the fingerprint is based on `kind + dictId + chapterIndex`. Presentation/planning metadata (title, reason, due date, estimate) is deliberately excluded.

This solves two different concerns without conflating them:

- `planRevision` answers “which plan version did this run start from?”;
- `taskFingerprint` answers “does this run still target the same executable task?”.

A later revision that only changes due date can still accept the run. A revision that moves the task to another dictionary/chapter cannot inherit the old run's completion evidence. New task-linked facts carry this provenance to Supabase, where `get_plan_status` validates the fingerprint against current task config before counting completion.

Historical completion facts that predate this field remain readable for compatibility; historical facts are never rewritten.

Current production also keeps at most one active Cloud Plan per owner. This is intentionally simple for the present English-first product. If a second real learning domain later requires simultaneous independent commitments, evolve the invariant to owner + domain/lane rather than removing lifecycle constraints altogether.

## Security boundary

Browser clients use only a Supabase publishable key plus an authenticated user session. `service_role` / secret keys must never be present in the client bundle. Exposed tables use RLS and ownership predicates based on `auth.uid()`.

The MCP layer calls narrowly scoped RPCs and must not expose arbitrary SQL execution to ChatGPT. Capabilities gate future-intent writes and bounded actions; they never grant generic historical-fact mutation.

## Delivery evolution

### Foundation / Sync

- Preserve Qwerty baseline.
- Add local append-only learning events.
- Add Supabase Auth, owner isolation, idempotent sync and cross-device restore.

### Read-only AI → bounded coaching

- Expose summary-first evidence reads.
- Add Learning Intent with scope / expiry / revision.
- Keep Smart Session deterministic and locally executable without waiting for AI.

### Explicit commitments / controlled actions

- Cloud Plan stores small, explicit, auditable tasks.
- Command Bus can open Today/dictionary/chapter or start a task on an authorized device.
- Starting/opening is never completion.

### Exam expansion

Reuse the same fact/intent/session/plan infrastructure for reading, cloze, translation and past-paper practice, but keep domain-specific event payloads, evidence reducers and completion contracts.

## Evolution boundary: shared infrastructure, domain-specific evidence

The semantic slice demonstrates a new activity without rewriting typing, OAuth or elastic-v2. Keep the common event envelope/sync, owner identity, session orchestration, content identity/version and bounded future intents; route activity payloads to separate domain validators and evidence reducers.

Future content provider minimum: stable identity, exact version, domain/activity, source/provenance, public/private ownership and licensing status, validated availability, estimated cost with basis, executor admission. Semantic v1 implements stable identity + exact local reference hash; it does **not** establish legal provenance or a full-book denominator for legacy dictionaries. Unknown licensing remains unknown; private materials stay outside public git. Do not build a CMS now.

Literature remains frozen. Future ancient Chinese, modern/contemporary Chinese, foreign literature and literary theory need their own knowledge/response semantics, not shared spelling or generic mastery. Recall outlines, long responses, argument/rubric evidence and text analysis can reuse facts/session/plan infrastructure while having different payloads and validators. Verify the target-year official university catalog before implementing exam-specific content.

Past-paper seam: versioned paper → section/passage → question identities and attempts, with domain-specific completion rules. Existing chapter completion is not a universal completion contract. Future cross-subject planning should allocate one global time budget before domain admission; no cross-subject planner is implemented here.
