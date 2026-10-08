# Wenyan next generation — durable handoff

Started 2026-10-08 (Asia/Shanghai). Branch: `astra/wenyan-next-generation`.

## Verified baseline

- Fresh remote main: `2807972579daa0ce36f42cd17575f2e9e7b2ab37`, PR #48 merged. No open PR returned by GitHub search at start.
- Read AGENTS.md, README.md, STATUS.md, IMPLEMENTATION_PLAN.md. STATUS is stale in several sections (still cites PR #35 as current main).
- Supabase project `cmjhxvpkdeheujuteqoi`: production `wenyan-english-mcp` v13 ACTIVE, custom JWT verification (`verify_jwt=false` at gateway).
- Retrieved production source: shim imports exact commit `0baf8bd5c1ec49c5d1dc43aa8f3b8dadaf37bf1`; this is older than main. Do not claim repository features are deployed.
- Migration inventory ends at command_bus_executor_rls_order_fix. Repository execution availability migration is not yet in the returned production inventory.
- Existing OAuth grants, user events, secrets and private materials must not enter git.

## First high-value judgments

1. Production/context drift is a functional Agent-loop gap, not just deployment housekeeping. A coach cannot self-correct against executor availability it never receives.
2. Existing spelling observations are not semantic recall. The next learning slice must record its measurement conditions (recognition vs recall, revealed answer, self-assessment vs objective scoring), not invent mastery.
3. Keep elastic-v2 and the typing engine. Add one bounded activity through existing fact/sync/coaching seams; choose final scope after inspecting guards.
4. Restore/resume and truthful local-save feedback are higher value than another visual redesign.
5. Shared infrastructure should carry domain/content identities; domain results must remain separately typed. Literature is frozen: ancient Chinese, modern/contemporary Chinese, foreign literature and literary theory are future domains, not new pages or current exam-schema assumptions.

## State ledger

- Designed: initial priorities above.
- Implemented: handoff only at checkpoint 1.
- Tested / merged / deployed / smoke verified / real-user verified: no new feature claims yet.

## Next actions

Inspect event ingestion constraints, Reading maturity, Smart Session composition, coaching adapter and UI recovery. Select one complete vertical slice. Persist each meaningful increment. Check targeted semantics, use CI for general gates. Reconcile safe production changes only after source and migration review; preserve narrow RPC and custom JWT boundaries.

## Non-negotiable contracts

Immutable historical truth; AI writes bounded future intent only; stage changes require the user; command completion is not learning completion; no evidence is unknown; offline learning survives AI/cloud failures.

## Checkpoint 2 — semantic measurement and local execution

Selected semantic recall rather than Reading orchestration: only demo Reading provider exists; automatically recommending it would be misleading. Implementing self-reported English→meaning mental recall, feedback reveal, then three-way rating. This is NOT objective marking, recognition, semantic mastery, sense-specific comprehension or FSRS. Retrieval practice + feedback informs the interaction; the self-report boundary is a product measurement decision (https://pdf.retrievalpractice.org/RetrievalPracticeGuide.pdf).

Implemented working draft: sourceVersion 4 semantic facts and restore validator; Dexie v7 additive semanticRuns; independent semantic candidate lane in elastic-v2; owner-bound run; atomically save fact + cursor; persist reveal before showing answer; resume-after-reveal recorded; reference content hash, no copyrighted definitions uploaded; Today routes selected semantic blocks to a keyboard-capable runner. Still integrating cloud evidence and availability, tests and release gates pending. Do not deploy this checkpoint yet.

Found and corrected adapter's hard-coded preferredActivities=['vocabulary']; it otherwise discards legitimate future activity intent. Future timestamps are excluded from local spelling candidates instead of poisoning the planner.

Git HTTPS push has no credential helper in this environment. Durable checkpoints use the authorized GitHub Git Data/Contents connector, with expected-head lease. First checkpoint and Draft PR #49 are confirmed remote. No credentials requested or placed in files.
