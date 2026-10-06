# MCP tool contract

The first Wenyan MCP release is read-only. ChatGPT receives explicit learning tools, never arbitrary SQL access.

The database migration also enforces this boundary: sessions carrying a Supabase OAuth `client_id` may read owned learning data, but the event-ingest path rejects OAuth clients. The normal Wenyan desktop/browser session remains responsible for writing study facts.

## Initial tools

### `get_learning_overview`

Backed by the Supabase RPC of the same name.

Inputs:
- `days` (1–365, default 7)

Returns:
- total learning events
- study days
- word attempts
- first-try correct count and percentage
- average inter-key typing duration

The current duration metric comes from Qwerty's existing per-key timing data. It is **not** yet a true recall-latency metric because time before the first keypress is not captured. A future event schema revision should add first-key reaction time explicitly rather than pretending the current value measures recall speed.

### `get_weak_words`

Backed by the Supabase RPC of the same name.

Inputs:
- `days` (default 30)
- `limit` (1–200, default 50)

Returns an explainable ranking containing attempts, mistake attempts, average inter-key typing duration and last seen time.

## Planned read tools

- `get_word_history`
- `get_slow_words`
- `get_frequent_mistakes`
- `get_recent_sessions`
- `get_mastery_distribution`
- `explain_word_state`

## Write boundary

No write tool should be exposed until cross-device sync and read-only MCP have been stable. Later write tools should be narrow actions such as `create_review_session` or `set_daily_goal`; raw event mutation and arbitrary SQL remain out of scope.
