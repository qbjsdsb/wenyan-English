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
