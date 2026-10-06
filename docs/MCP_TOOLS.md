# MCP tool contract

The first Wenyan MCP release is read-only. ChatGPT receives explicit learning tools, never arbitrary SQL access.

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
- average word duration

### `get_weak_words`

Backed by the Supabase RPC of the same name.

Inputs:
- `days` (default 30)
- `limit` (1–200, default 50)

Returns an explainable ranking containing attempts, mistake attempts, average duration and last seen time.

## Planned read tools

- `get_word_history`
- `get_slow_words`
- `get_frequent_mistakes`
- `get_recent_sessions`
- `get_mastery_distribution`
- `explain_word_state`

## Write boundary

No write tool should be exposed until cross-device sync and read-only MCP have been stable. Later write tools should be narrow actions such as `create_review_session` or `set_daily_goal`; raw event mutation and arbitrary SQL remain out of scope.
