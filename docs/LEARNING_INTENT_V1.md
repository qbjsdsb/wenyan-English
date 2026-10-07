# Learning Intent v1

> 2026-10-08 续接：当前实现状态见 [STATUS](STATUS.md)；AI 策略、证据摘要、阶段确认及阅读候选边界以 [AI_COACHING_LOOP_V1](AI_COACHING_LOOP_V1.md) 为准。本文的旧阶段状态不代表当前部署。

## Purpose

Learning Intent is Wenyan's versioned, bounded representation of future learning preferences. It lets ChatGPT and Wenyan adjust what should happen next without rewriting past learning truth.

Core invariant:

> AI may control future learning intent, but must never rewrite past learning truth.

## Scopes

There is at most one row per user for each scope:

- `ongoing` — medium-term preference, no required expiry.
- `day` — temporary preference, must expire within 48 hours of `effectiveFrom`.
- `session` — immediate preference, must expire within 12 hours of `effectiveFrom`.

Consumers should merge active constraints in this order:

`session > day > ongoing > local defaults`

Expired or archived scopes do not apply.

## Constraints

The v1 RPC whitelist supports:

- `focusDictionary`
- `targetMinutes`
- `hardStopMinutes`
- `newWordCeiling`
- `reviewPreference`: `balanced | review_first`
- `intensity`: `gentle | normal`
- `preferredActivities`

These are intent and planner constraints, not evidence.

## Goals and rationale

Goals are bounded future objectives (`exam_preparation`, `reading_transfer`, `question_practice`).

Rationale is explicitly interpretation metadata. It may include a summary, basis, evidence IDs, confidence and uncertainties. None of those fields become immutable learning facts.

## Storage and revision model

- `learning_intents` holds the current value for each scope.
- `learning_intent_revisions` stores revision snapshots.
- `learning_intent_mutation_receipts` makes mutations idempotent by `(user, client, requestId)`.
- Optimistic revision locking prevents stale AI or browser writes from silently overwriting newer intent.
- Same-scope mutations are serialized with a transaction advisory lock.

## Security

All public tables use RLS and explicit Data API grants.

OAuth writes require the existing `coach:auto_adjust` capability and can only write through the narrow `revise_learning_intent` / `clear_learning_intent` SECURITY INVOKER RPCs. Direct browser sessions may use the same RPCs for first-party UI controls.

No browser or plugin receives `service_role` credentials.

## Next integration

1. Expose `get_learning_intents`, `revise_learning_intent` and `clear_learning_intent` through the Wenyan English MCP.
2. Add a browser client reader that converts active scopes into `SessionConstraints`.
3. Merge constraints `session > day > ongoing > defaults` before `buildSmartSession`.
4. Keep network failure non-blocking: local defaults must still allow study.
5. Add Today UI only after the contract works end-to-end; avoid turning the page into an AI dashboard.
