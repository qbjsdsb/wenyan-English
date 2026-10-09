# Learning data model

更新：2026-10-07。

## Why events

Qwerty already stores useful local records, but those records are shaped around the current UI. Wenyan adds a second, append-only layer whose job is to describe durable learning facts that can survive future UI changes.

Current event types remain deliberately small:

- `word_attempted`
- `chapter_completed`

Existing `wordRecords`, `chapterRecords` and `reviewRecords` continue to power the current product. Wenyan facts are the durable analysis/sync layer; they do not require rewriting Qwerty's learning engine.

## Local event envelope

```text
id             client UUID v4
 eventType      stable event name
 occurredAt     client timestamp in milliseconds
 sourceVersion  Wenyan English fact protocol version (legacy local rows imply v1)
 syncState      pending | synced | failed
 syncAttempts   retry counter
 ownerUserId    local account-isolation marker when known
 lastSyncError  optional diagnostic
 payload        event-specific fact data
```

The UUID is generated before sync and never changes. The same event may therefore be retried without creating a second server row.

Server rows additionally store `source='wenyan-english'`, `source_version`, `user_id`, and server `created_at`. `source_version` is copied from the local fact version rather than hard-coded during upload.

## v1 facts

### `word_attempted` v1

```text
word
 dict
 chapter
 reviewMode
 wrongCount
 durationMs
 timing[]
 mistakes{}
```

`durationMs` is the sum of inter-key timings already captured by Qwerty. It does not include the time before the first keypress and must not be described as recall latency. `mistakes` preserves which wrong key was pressed at each character position.

### `chapter_completed` v1

```text
dict
 chapter
 reviewMode
 durationSeconds
 correctCount
 wrongCount
 wordCount
 wordNumber
 firstTryCorrectCount
```

## v2 groundwork

New word attempts are emitted as source version 2. v2 keeps every v1 field and adds raw, directly observed context instead of guessing cognitive state:

```text
dictationEnabled
 dictationType   hideAll | hideVowel | hideConsonant | randomHide
 taskRunId?      only after local run validation
 planId?
 taskId?
```

`dictationEnabled/dictationType` describe the Qwerty UI conditions that were actually active. They are not automatically relabeled as “semantic recall”, “listening ability”, or another stronger claim.

When a word is opened from a study-plan run, Wenyan resolves the local `StudyPlanRun`, plan and task before attaching task context. The actual dict/chapter must match, the run must still be active, and review mode is not linked to a chapter task. A stale or forged `taskRun` URL therefore does not become evidence.

A `chapter_completed` event is promoted to v2 and receives the same `taskRunId / planId / taskId` only when the existing real-completion rule succeeds: the correct dict/chapter was practised, all chapter words have real word records, and the task has not already been completed by another run.

## Atomic local evidence

For new word attempts, the legacy Qwerty `wordRecords` row and the Wenyan `learningEvents` row are written in one Dexie transaction. Either both persist or neither persists. This prevents an old UI record from existing without its corresponding long-term fact after a local storage failure.

Chapter record, completion fact and plan-run completion are likewise committed transactionally.

## Restore compatibility

Current clients accept Wenyan English source versions 1 and 2. v2 task and raw dictation fields are preserved during cloud restore.

Unknown future source versions still stop a restore page before its cursor advances. This is intentional: an older client must not silently skip facts it cannot interpret.

## Still missing before richer AI analysis

v2 groundwork does **not** yet claim the following signals:

- true first-key recall latency;
- explicit session start/pause/finish facts;
- `word_skipped` facts;
- reliable hint/reveal usage;
- active duration with background/pause time removed;
- normalized follow / recall / listen practice mode.

These should be added only with measurement semantics that survive pause, blur and mode changes. Missing historical fields stay missing; they are never backfilled by guesswork.

## Server truth

`public.learning_events` is the durable fact table. It is append-only for normal clients. Derived concepts such as mastery, weak words, review urgency and study summaries are computed from events and can change as algorithms improve.

AI tools must never be allowed to silently rewrite historical events just to make a recommendation look cleaner.

## Semantic recall v1 (sourceVersion 4; next-generation branch)

`semantic_recall_attempted` is a separate immutable fact. Fields: domain=english, activity=semantic_recall, direction=en_to_meaning, cue=word_only, responseMode=mental_recall, measurement=self_report_after_reveal, answerRevealed=true, resumedAfterReveal, rating=recalled|partial|not_recalled, dictionaryId/word, contentId/contentVersion, sessionId/blockId. The observation is the **user's report**, not objectively checked correctness. No response latency or mastery score is recorded.

Content identity is dictionary + normalized surface, independent of array ordinal. SHA-256 versions the exact displayed word/reference meanings. Definition text stays local; no new corpus is uploaded or committed. Changed definitions are a different evidence version. Multi-sense recognition and reading comprehension are not measured.

Dexie v7 adds semanticRuns without touching legacy tables. Reveal is persisted before rendering; fact and run cursor commit in one transaction. Failed storage leaves the current item in place. Only all real ratings finish a run; stopping sets runtime endedAt and does not synthesize completion. The existing owner-scoped sync queue ingests v4 facts. Restore validates measurement fields before moving the cursor. Old clients encountering v4 stop restoration and require update; do not silently skip new facts. Existing chapter Cloud Plan completion rules remain unchanged.

Future domain events should reuse the envelope, owner/sync/idempotency, session/plan references and versioned content identity. Keep separately typed domain payloads: neither an essay nor a literary concept belongs in WordAttemptedPayload. Do not retrofit historical rows or assign missing domain semantics by guesswork.


## Device-local vocabulary checkpoint (Dexie v8, PR #56)

`typingCheckpoints: &id,updatedAt` is mutable execution state, not a learning event and not part of cloud sync. Key = JSON tuple `[ownerUserId|null, dictionaryId, chapter, taskRunId|null]`; each attempt has a fresh runId. Exact content signature covers ordered source indices, names, reference meanings, phonetics and notation; the stored presentation order is preserved and validated against that source. Ordinary English chapters only; Smart Session and review retain their existing resume mechanisms.

The word record, immutable word fact and post-commit checkpoint share one Dexie transaction. Stored state carries committed record IDs, distinct practised indices and repetition count. Partial current-word input is deliberately not restored. Timer restores to the last committed boundary, not wall time. Restore checks owner/content/order/counters and referenced records; a changed source discards only the invalid cursor, never past facts. Restored state starts paused.

A genuinely completed normal chapter clears its checkpoint in the same transaction as the chapter record/fact. A normal chapter ended through skips without practising every item does not produce a chapter completion; saved word attempts remain. Restart clears only execution state. Pending final-word checkpoint allows a failed chapter commit to recover after refresh without replaying word facts. This adds no Supabase schema, new sync payload or AI write capability.


Completion compatibility note: the stricter normal-chapter guard applies to new client execution. Older v1/v2 chapter facts are not rewritten and may reflect the legacy end-of-chapter behavior, including skips. A historical chapter count alone is not proof that every item was attempted; item-level immutable facts remain the stronger evidence.
