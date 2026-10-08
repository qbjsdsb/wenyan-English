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
