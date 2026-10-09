# Objective Semantic Evidence v1

Baseline: `main` at `89b726c421eef3056e3a9a343bf26b2d326d76bd` after PR #53.

## Goal

Add one objectively scored semantic measurement without pretending that a multiple-choice result is general vocabulary mastery.

The existing `semantic_recall_attempted` fact remains a **self-report after reveal**. It must not be relabeled, overwritten, or merged into an opaque mastery score.

## Measurement contract

v1 measurement: `reference_meaning_discrimination`.

The learner sees one English cue and several meaning references. Exactly one option is the versioned meaning reference attached to the cue in the current Wenyan dictionary; the other options are versioned references from other eligible words in the same run/dictionary context.

A correct result means only:

> the learner selected the current dictionary reference for this cue among the presented alternatives.

It does **not** prove free recall, contextual comprehension, production ability, 熟词僻义 coverage, collocation knowledge, or global semantic mastery.

## Safety / epistemic rules

- No LLM-generated distractors.
- No synthetic fake definitions.
- No spelling evidence converted into semantic correctness.
- No FSRS / memory-strength score in this phase.
- No objective check when fewer than 4 safely distinct references are available.
- Option identity/version is persisted so the historical fact remains interpretable if dictionaries later change.
- Historical facts are append-only; AI may only influence future intent.
- Objective discrimination and self-report recall remain separate evidence channels in Coaching Context.

## Fact shape

New event: `semantic_discrimination_attempted`, source version 5.

Payload keeps:

- `domain: english`
- `activity: semantic_discrimination`
- `measurement: reference_meaning_discrimination`
- cue/content identity and exact content version
- dictionary/session/block identity
- stable option references and display order
- selected reference
- correct reference
- objective `isCorrect`
- response mode `single_choice`

## Derived evidence

Objective evidence is exposed separately from self-report semantic evidence as `derived.semanticDiscriminationEvidence`.

It contains only bounded descriptive evidence:

- attempts
- correct / incorrect
- distinct versioned items
- recent incorrect item references
- excluded malformed facts
- 14-day coverage metadata

Interpretation explicitly says this is reference discrimination, not semantic mastery.

## Implemented vertical slice

1. **Deterministic option builder** — `src/semantic/discrimination.ts` uses only existing versioned semantic items, rejects unsafe/duplicate meaning references, requires four distinct references and uses stable ordering without random/AI-generated content.
2. **Immutable local fact** — `semantic_discrimination_attempted` sourceVersion 5 persists exact option identities/versions, selected reference and verified score.
3. **Atomic progress** — fact write and discrimination cursor advancement share one Dexie transaction; a failed write cannot silently advance the exercise.
4. **Sync compatibility** — the generic learning-event queue/ingest path already accepts the new event type and source version; no database schema migration is required.
5. **Keyboard-first surface** — `/semantic-check/:runId` supports 1–4 selection, feedback, reload recovery, owner isolation and hard-stop inheritance.
6. **Natural entry** — a completed semantic-recall block offers the objective check only when at least four safely distinct versioned references exist and session time remains.
7. **Coaching Context v1.5** — MCP reads sourceVersion 5 objective facts separately from sourceVersion 4 self-report facts, includes both in the snapshot fingerprint, and keeps explicit epistemic boundaries.
8. **Targeted validation** — deterministic semantic guardrails, cloud adapter expectations and Playwright semantic flow cover the new contract. Full repository CI remains the merge gate.

## Runtime boundary

The objective check is an optional follow-up to a completed Smart Session semantic-recall block. v1 intentionally does **not** make `semantic_discrimination` a new Smart Session planner purpose/activity. This avoids widening executor semantics before enough real evidence exists to justify automatic scheduling.

Refreshing the objective page resumes at the next unanswered item. Leaving the objective page for Today does not yet create a separate Smart Session resume card; the objective facts already saved remain valid and immutable.

## Production boundary

Before merge/deploy:

- full CI must pass;
- the updated `wenyan-english-mcp` source must be deployed and smoke-checked before claiming Coaching Context v1.5 production availability;
- no fake user learning facts may be inserted for validation.

## Deferred

- contextual sentence meaning;
- 熟词僻义-specific provider;
- collocation / phrase recall;
- Chinese→English production;
- automatic Smart Session scheduling of objective discrimination;
- cross-device objective-run continuation;
- FSRS;
- literature evidence models.
