# Wenyan English architecture

## Product boundary

Wenyan English separates three responsibilities:

- **Learning UI** — Qwerty-derived typing, dictation, review and error-book experience.
- **Learning memory** — local Dexie first, Supabase as durable cross-device history and derived state.
- **Learning intelligence** — ChatGPT / MCP reads explicit tools and RPCs instead of receiving raw database access.

## Data flow

```text
Keyboard / study action
        |
        v
Qwerty learning UI
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

1. A network failure must never block typing or chapter completion.
2. Existing Qwerty records remain valid while the new event model is introduced.
3. Every remotely synced event has a stable client-generated UUID so retries are idempotent.
4. Raw learning events are append-only on the server.
5. Derived mastery and recommendations may be recalculated without rewriting history.

## Security boundary

Browser clients use only a Supabase publishable key plus an authenticated user session. `service_role` / secret keys must never be present in the client bundle. Exposed tables use RLS and ownership predicates based on `auth.uid()`.

The MCP layer should call narrowly scoped read RPCs such as `get_learning_overview` and `get_weak_words`; it should not expose arbitrary SQL execution to ChatGPT.

## Delivery phases

### Phase 1 — Foundation

- Preserve Qwerty baseline.
- Remove third-party behavior analytics.
- Add local append-only learning events.
- Add migration/RLS definitions.

### Phase 2 — Sync

- Add Supabase Auth and publishable client configuration.
- Sync pending local events in small idempotent batches.
- Restore history on a second desktop/browser.

### Phase 3 — Read-only AI

- Deploy authenticated MCP endpoint.
- Expose overview, weak words, slow words, mistakes and recent sessions.
- Keep all AI tools read-only.

### Phase 4 — Smart review

- Introduce explainable derived word state.
- Let AI create review plans through explicit constrained write tools.

### Phase 5 — Exam expansion

Reuse the same event layer for reading, cloze, translation, long sentences and past-paper practice.
