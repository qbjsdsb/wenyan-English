# Reading Intelligence Foundation v1

Independent stacked work from the Reading v1 line. The branch remains non-production until its own PR/CI and an explicit Supabase Edge deployment. It does not introduce a new Learning Fact protocol, automatic Reading executor, mastery score, or new Intent write authority.

## The decision that matters

Do not aggregate every `reading_completed` row as trustworthy question evidence. Cloud paging can split its question rows from its completion; old, invalid, duplicate or truncated rows can disagree. Report observed completion rows separately, and admit an attempt to the evidence denominator only after its complete question set reconciles with the completion and content version. Partial input is a declared observation scope, never a zero-performance diagnosis.

`src/coaching/reading/evidence.ts` is a pure TypeScript core. Explicit owner, time window, snapshot descriptor and retrieval coverage enter; bounded derived evidence leaves. It has no storage, network, model or clock writes. It accepts only v3 reading facts, strips all unspecified payload fields, checks selected/correct/null consistency, unique question IDs, counts, temporal order and passage version. Conflicting UUIDs and mixed owners fail closed. Invalid linked rows quarantine their attempt. Orphan, incomplete and rejected attempts are separate from valid denominators.

Window membership uses completion `occurredAt` inclusively; adapters must also supply linked question rows before the lower boundary. Future rows do not contribute. Same-ID identical transport rows deduplicate; conflicting same UUIDs fail closed. Different completion IDs claiming one attempt quarantine it. Sorting of input cannot change the result. No current question provider is needed to state what the recorded reference answer judged, but that is explicitly NOT independent verification of the answer key.

## Evidence, not diagnosis

Output is limited to raw counts, sample size, distinct passage IDs and versions, repeats within this window, answer-change counts, aggregate wall-clock duration, five recent attempt summaries, at most three sample question refs each, omitted counts and query provenance. There is no correctness percentage, mastery/readiness score, slope, cause attribution or automatic workload recommendation.

Repetition counts are window-local same-version exposures. They do not prove novelty, learning gain or even comparability because prior answer exposure, hints and testing conditions are not measured. Distinct versions are not silently merged for repeated-exposure calculations. Wall-clock duration keeps the v3 meaning including time away; no active time, reading speed, attention or per-question allocation is inferred.

Question tags currently lack an authenticated provider/version attestation in the fact envelope. `tagObservations=null` rather than promoting arbitrary tag strings into trusted inference evidence. A later adapter may supply a separately verified metadata join, never overwrite the original facts. Tags describe item classification, not why a person answered incorrectly.

No question text, option text, paragraphs, explanations, arbitrary metadata or private provider content is emitted. IDs are bounded opaque references. Query refs describe provenance, not a promise of snapshot replay. Historical interpretations must keep snapshotId, window, coverage and algorithm version; sample refs are not an exhaustive proof of an aggregate.

## Four boundaries

1. Facts: immutable recorded choices and reference outcomes.
2. Evidence: deterministic, versioned recomputation over a stated visible query.
3. Interpretation: revisable model hypothesis citing evidence and uncertainty; never a derived fact.
4. Intent: bounded future strategy, validated against current capabilities and eligible content.

Reading evidence does not make a content provider or automatic reading executor available. Stage changes still require user confirmation. Cloze, translation, writing and literature need their own measured contracts; there is intentionally no generic mastery aggregator.

## Local evidence path

`src/coaching/reading/localEvidence.ts` reads an owner-scoped, read-only IndexedDB snapshot. It caps the newest 20,000 Reading rows, marks truncation, includes pre-window question rows and verifies account ownership before and after the read. An attempt cut by the cap is excluded by reconciliation. `receivedThrough=null` does not pretend local read time is a cloud sync watermark.

`src/coaching/reading/context.ts` can compose that evidence with the existing local Coaching Context. It requires matching snapshot ID, through-time and timezone. Missing Reading input means not loaded, never zero activity. Existing vocabulary counts, capabilities, candidate eligibility and stage preferences keep their prior meaning.

## Cloud evidence path and Coaching Context v1.7

`supabase/functions/wenyan-english-mcp/readingEvidence.ts` is the owner-scoped cloud adapter. Owner isolation comes from the authenticated caller JWT plus Supabase RLS, matching the existing MCP cloud adapters.

The adapter freezes cloud visibility with `created_at <= now`, selects up to 500 `reading_completed` rows in a rolling 14-day completion window, then fetches all visible linked `question_attempted` rows by `attemptId` without applying the lower completion-window bound to those question rows. This preserves attempts whose question facts began before the window boundary but completed inside it. Linked rows are paged and the total Reading input is capped at 20,000 rows. Any cap produces partial coverage rather than a complete-looking denominator.

Only the measured v3 fields required by the evidence core survive the adapter. Malformed or arbitrary payloads are not copied into the Coaching Context fingerprint. Article, question and option text never enters the AI payload.

`supabase/functions/wenyan-english-mcp/coachingV17.ts` composes the stable v1.6 context with Reading. The final snapshot fingerprint includes the prior snapshot ID, Reading status, sanitized Reading rows and Reading coverage. Reading evidence is built only after that final snapshot ID exists, so its embedded `snapshotId` matches the returned Coaching Context.

The new context exposes `derived.readingEvidence` plus an explicit `readingStrategyBoundary`. Its mode is `advisory_only`; evidence never authorizes execution. A future Reading intent requires a supported intent contract, fresh provider candidates, current eligibility and a deterministic executor. Private Reading content exposure is explicitly false.

Cloud query failure produces `status=unavailable`, `summary=null` and uncertainty stating that unavailable is not zero activity. An observed empty but successful cloud query remains distinct from an unavailable query.

Production Edge dispatch in this branch points to `coaching-context-v1.7`, while the legacy Node adapter regression remains pinned to v1.5. The transport budget stays hard-capped at 24 KiB.

## Verification added on this branch

- `scripts/check-reading-evidence.mjs` guards pre-window linked question reconciliation, incomplete-attempt exclusion, conflicting UUID fail-closed behavior and owner mismatch rejection.
- `scripts/check-coaching-production.mjs` now covers v1.7 Reading + semantic-production coexistence, deterministic snapshot fingerprinting, Reading-result changes affecting the fingerprint, unavailable Reading remaining unknown, advisory-only boundaries and the 24 KiB budget.
- CI names the new Reading evidence guardrail and Coaching Context v1.7 production regression explicitly.

This branch still requires its own pull-request CI after reconciliation with the final Reading v1 merge. No Supabase Edge deployment has been performed for v1.7.

## Still not implemented

- persisted/replayable multi-source snapshots;
- authenticated provider-tag joins;
- persisted AI interpretation;
- Reading provider candidate exposure for strategy/execution;
- a supported Reading execution Intent contract;
- automatic Reading execution in Smart Session;
- cloze, translation, writing or literature evidence contracts.

## Next highest-value step

First finish and merge Reading v1, then run this stacked branch through full CI against that production tree. If it is green, merge the evidence/MCP code without silently changing learning semantics. Only after a deliberate Supabase Edge v1.7 deployment and a real `$wenyan` consumer check should Reading strategy interpretation be considered production-connected. Gather real Reading facts before designing automatic Reading intent/execution.
