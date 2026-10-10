# Learning data model

更新：2026-10-10。

## Why events

Qwerty already stores useful local records, but those records are shaped around the current UI. Wenyan adds a second, append-only layer whose job is to describe durable learning facts that can survive future UI changes.

Existing `wordRecords`, `chapterRecords` and `reviewRecords` continue to power parts of the current product. Wenyan facts are the durable analysis/sync layer; they do not require rewriting Qwerty's learning engine.

Core rule：

> Historical learning truth is immutable. Future intent / plan state may change; past facts do not.

## Local event envelope

```text
id             client UUID v4
eventType      stable event name
occurredAt     client timestamp in milliseconds
sourceVersion  Wenyan English fact protocol version
syncState      pending | synced | failed
syncAttempts   retry counter
ownerUserId    local account-isolation marker when known
lastSyncError  optional diagnostic
payload        event-specific fact data
```

The UUID is generated before sync and never changes. The same event may therefore be retried without creating a second server row.

Server rows additionally store `source='wenyan-english'`, `source_version`, `user_id`, and server `created_at`. `source_version` is copied from the local fact version rather than hard-coded during upload.

## Server truth

`public.learning_events` is the durable fact table. It is append-only for normal clients. Derived concepts such as review urgency, weak-word evidence, semantic evidence and study summaries can be recomputed without rewriting history.

AI tools must never silently rewrite historical events just to make a recommendation or plan look cleaner.

## Spelling facts

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

## v2 task / raw UI context

New spelling attempts use sourceVersion 2. v2 keeps v1 fields and may add directly observed UI / explicit-task context:

```text
dictationEnabled
dictationType   hideAll | hideVowel | hideConsonant | randomHide

taskRunId?
planId?
taskId?
planRevision?
taskFingerprint?
```

`dictationEnabled / dictationType` describe the UI conditions that were actually active. They are not automatically relabelled as “semantic recall”, “listening ability”, or another stronger claim.

### Explicit Plan task identity

The task reference is all-or-nothing: `taskRunId / planId / taskId` travel together. `planRevision / taskFingerprint` are optional provenance fields for compatibility with historical v2 rows, but new Cloud Plan runs capture both.

For new Cloud Plan runs:

- `ownerUserId` is stored on the local `StudyPlanRun`;
- `planRevision` records the plan revision observed when the run started;
- `taskFingerprint` records the exact executable target.

The current chapter executor uses:

`chapter:<dictId>:<chapterIndex>`

The fingerprint deliberately excludes title, reason, due date and estimated minutes. Those are planning metadata; editing them does not change what the learner is actually practising. Changing dictionary/chapter does change the fingerprint.

When a word/chapter is opened from a task run, Wenyan resolves the local `StudyPlanRun`, plan and task before attaching task context. For Cloud Plans it also requires the current owner, active cloud cache, run owner, revision provenance and fingerprint. A stale URL, changed account, legacy unbound cloud run or changed executable target therefore cannot silently become Plan completion evidence.

If task identity cannot be proven, **ordinary learning still saves**; only the unreliable Plan/task linkage is omitted. Network/cloud state must not block truthful local study.

### Completion identity

A `chapter_completed` event receives Plan task context only when the existing real-completion rule succeeds: correct dict/chapter, all chapter words have real word records, the run is still valid, and the task has not already been completed by another run.

Production `get_plan_status` matches completion by owner + `planId / taskId`, and for new fingerprint-bearing facts additionally requires `taskFingerprint` to match the current task config.

`planRevision` is provenance, **not** an equality gate. A revision that only changes due date/title/reason/estimate may still accept an in-flight run if the executable fingerprint is unchanged. A revision that changes dictionary/chapter cannot inherit that run's completion.

Historical pre-fingerprint completion facts remain readable; history is not retrofitted or rewritten.

## Atomic local evidence

For new word attempts, the legacy Qwerty `wordRecords` row and the Wenyan `learningEvents` row are written in one Dexie transaction. Either both persist or neither persists. This prevents an old UI record from existing without its corresponding long-term fact after a local storage failure.

Chapter record, completion fact and plan-run completion are likewise committed transactionally.

## Restore compatibility

Current clients preserve sourceVersion 1/2 spelling facts, including optional `planRevision / taskFingerprint` provenance on v2 rows. Malformed partial task identity is rejected before the restore cursor advances.

Unknown future source versions stop restore before its cursor advances. An older client must not silently skip facts it cannot interpret.

## Semantic recall v1 — sourceVersion 4

`semantic_recall_attempted` is a separate immutable fact. Core fields include:

```text
domain=english
activity=semantic_recall
direction=en_to_meaning
cue=word_only
responseMode=mental_recall
measurement=self_report_after_reveal
answerRevealed=true
rating=recalled|partial|not_recalled
dictionaryId / word
contentId / contentVersion
sessionId / blockId
```

The observation is the **user's report**, not objectively checked correctness. No response latency or mastery score is invented.

Content identity is dictionary + normalized surface, independent of array ordinal. SHA-256 versions the exact displayed word/reference meanings. Changed definitions are a different evidence version.

Reveal is persisted before rendering; fact and run cursor commit in one transaction. Failed storage leaves the current item in place. Only all real ratings finish a run; stopping does not synthesize completion.

## Objective semantic discrimination — sourceVersion 5

`semantic_discrimination_attempted` measures `reference_meaning_discrimination`.

- English cue → choose the matching current versioned reference meaning;
- options come only from real dictionary reference meanings;
- at least four safe/different options are required;
- no LLM-generated fake definition / distractor;
- answer can be objectively scored;
- fact and question cursor commit atomically.

Correct recognition does not imply free recall, contextual comprehension, Chinese→English production, collocation knowledge or semantic mastery. Recognition evidence and semantic recall self-report stay separate.

## Manual vocabulary practice

`semanticRuns.origin = manual` distinguishes direct practice from Smart recovery; payload/source versions and owner isolation remain unchanged.

Direct spelling uses an existing ReviewRecord with optional `origin=manual` and `ownerUserId`. At each complete word, legacy spelling record, immutable fact and review cursor update share one transaction. Presented order is frozen instead of re-shuffled on refresh. Partial-word input is not recovered; already persisted observations remain history.

Manual pools use current-owner immutable facts: learned requires a spelling observation; spelling errors require the latest attempt still incorrect within 14 days; semantic uncertainty uses latest recall/selection separately per current content version. No evidence is unknown, not weakness. Recognition success never clears a recall self-report, and vice versa.

## Device-local vocabulary checkpoint (Dexie v8)

`typingCheckpoints: &id,updatedAt` is mutable execution state, not a learning event and not part of cloud sync.

Key binds owner / dictionary / chapter / taskRun. Exact content signature covers the presented source; presentation order is preserved and validated. Word record, immutable word fact and post-commit checkpoint share one Dexie transaction.

Partial current-word input is deliberately not restored. Restore returns to the last committed boundary. A genuinely completed normal chapter clears its checkpoint in the same transaction as chapter record/fact. Navigation/skips without practising all items do not produce a chapter completion.

This is device-local execution recovery, not cross-device run migration or a complete offline PWA.

## Reading / future domains

Reading already has separately typed `question_attempted` / `reading_completed` facts. Future content domains should reuse the common envelope, owner/sync/idempotency, session/plan references and versioned content identity, but keep domain-specific payloads and validators.

Neither an essay nor a literary concept belongs in `WordAttemptedPayload`. Existing chapter completion is not a universal completion contract.

## Still missing before richer inference

Current spelling facts do **not** justify backfilling or inferring:

- true first-key recall latency;
- reliable active duration with all pause/background time removed;
- generic semantic mastery;
- memory strength / FSRS rating from wrongCount;
- unknown historical hint/reveal behavior.

Missing historical fields stay missing; they are never reconstructed by guesswork.
