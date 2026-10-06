# Learning data model

## Why events

Qwerty already stores useful local records, but those records are shaped around the current UI. Wenyan adds a second, append-only layer whose job is to describe durable learning facts that can survive future UI changes.

The first event types are deliberately small:

- `word_attempted`
- `chapter_completed`

Existing `wordRecords`, `chapterRecords` and `reviewRecords` remain untouched and continue to power the current product.

## Local event envelope

```text
id            client UUID v4
 eventType     stable event name
 occurredAt    client timestamp in milliseconds
 syncState     pending | synced | failed
 syncAttempts  retry counter
 lastSyncError optional diagnostic
 payload       event-specific fact data
```

The UUID is generated before sync and never changes. The same event may therefore be retried without creating a second server row.

## word_attempted payload

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

`durationMs` is the sum of inter-key timings already captured by Qwerty. `mistakes` preserves which wrong key was pressed at each character position.

## chapter_completed payload

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

## Server truth

`public.learning_events` is the durable fact table. It is append-only for normal clients. Derived concepts such as mastery, weak words, review urgency and study summaries are computed from events and can change as algorithms improve.

AI tools must never be allowed to silently rewrite historical events just to make a recommendation look cleaner.
