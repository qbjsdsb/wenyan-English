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

It does **not** prove free recall, contextual comprehension, production ability,熟词僻义 coverage, collocation knowledge, or global semantic mastery.

## Safety / epistemic rules

- No LLM-generated distractors.
- No synthetic fake definitions.
- No spelling evidence converted into semantic correctness.
- No FSRS / memory-strength score in this phase.
- No objective check when fewer than 4 safely distinct references are available.
- Option identity/version is persisted so the historical fact remains interpretable if dictionaries later change.
- Historical facts are append-only; AI may only influence future intent.

## Fact shape

New event: `semantic_discrimination_attempted`.

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

Keep objective and self-report evidence separate. Objective evidence may expose:

- attempts
- correct / incorrect
- distinct versioned items
- recent incorrect item references
- excluded malformed facts

Interpretation must explicitly say this is reference discrimination, not semantic mastery.

## Vertical slice target

1. deterministic option builder from existing versioned semantic items;
2. immutable local fact with objective score;
3. sync-compatible event type;
4. bounded derived evidence next to self-report semantic evidence;
5. usable keyboard-first learning surface;
6. expose the objective evidence to Coaching Context without collapsing epistemic levels;
7. targeted deterministic/browser tests only.

## Deferred

- contextual sentence meaning;
-熟词僻义-specific provider;
- collocation / phrase recall;
- Chinese→English production;
- FSRS;
- literature evidence models.
