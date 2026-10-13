# Reading Intelligence Foundation v1

Independent stacked work from `993f75029e071b2d37e5ec95b0d58416cb1719da`; PR #97 remains sealed. No deployment, merge or new fact protocol.

## The decision that matters

Do not aggregate every reading_completed row as trustworthy question evidence. Cloud paging can split its question rows from its completion; old/invalid/duplicate rows can disagree. Report observed completion rows separately, and admit an attempt to the evidence denominator only after its complete question set reconciles with the completion and content version. Partial input is a declared observation scope, never a zero-performance diagnosis.

`src/coaching/reading/evidence.ts` is a pure TypeScript core. Explicit owner, time window, snapshot descriptor and retrieval coverage enter; bounded derived evidence leaves. It has no storage/network/model/clock writes. It accepts only v3 reading facts, strips all unspecified payload fields, checks selected/correct/null consistency, unique question IDs, counts, temporal order and passage version. Conflicting UUIDs and mixed owners fail closed. Invalid linked rows quarantine their attempt. Orphan, incomplete and rejected attempts are separate from valid denominators.

Window membership uses completion occurredAt (inclusive); adapters must also supply linked question rows before the lower boundary. Future rows do not contribute. Same-ID duplicate transport rows deduplicate; different completion IDs claiming one attempt quarantine it. Sorting of input cannot change the result. No current question provider is needed to count what the recorded reference answer judged; that is explicitly NOT independent verification of the answer key.

## Evidence, not diagnosis

Output: raw counts, sample size, distinct passage IDs and versions, repeats within this window, answer-change counts, aggregate wall-clock duration, five recent attempt summaries, at most three sample question refs each, omitted counts and query provenance. No correctness percentage, mastery/readiness score, slope, cause attribution or automatic workload recommendation.

Repetition counts are window-local same-version exposures. They do not prove novelty, learning gain or even comparability: prior answer exposure, hints and testing conditions are not measured. Distinct versions are not silently merged for repeated-exposure calculations. Wall-clock duration keeps the v3 meaning including time away; no active time, reading speed, attention or per-question allocation is inferred.

Question tags currently lack an authenticated provider/version attestation in the fact envelope. `tagObservations=null` rather than promoting arbitrary tag strings into trusted inference evidence. A later adapter may supply a separately verified metadata join, never overwrite the original facts. Tags describe item classification, not why a person answered incorrectly.

No question/option text, paragraphs, explanations, arbitrary metadata or private provider content is emitted. IDs are bounded opaque references. Query refs describe provenance, not a promise of snapshot replay. Historical interpretations must keep snapshotId, window, coverage and algorithm version; sample refs are not an exhaustive proof of an aggregate.

## Four boundaries

1. Facts: immutable recorded choices and reference outcomes.
2. Evidence: deterministic, versioned recomputation over a stated visible query.
3. Interpretation: revisable model hypothesis citing evidence and uncertainty; never a derived fact.
4. Intent: bounded future strategy, validated against current capabilities and eligible content. Reading evidence does not make a content provider or automatic reading executor available. Stage changes still require user confirmation.

Reuse the envelope pattern (activity / measurement / window / coverage / observations / evidence / uncertainty) for future activities, not the reading-specific question join. Cloze, translation, writing and literature need their own measured contracts; there is intentionally no generic mastery aggregator or empty activity registry.

## Implementation state

First slice: pure evidence core and this contract. Context wiring and local adapter follow separately. No MCP endpoint or production response has changed. No tests, builds, lint or deployment have been run for this work.
