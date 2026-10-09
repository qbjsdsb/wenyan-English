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

## Checkpoint 3 — closed code path and deployment findings

- Semantic facts → existing outbox/owner RLS → restore v4 → bounded semantic evidence → Coaching Context v1.4 → existing bounded intent (`semantic_recall`) → deterministic lane → Today runner implemented on branch.
- New MCP Agent guidance distinguishes unknown/stale, resume, ready, break, cooldown wait and explain/revise. Same command receipt still cannot mean learning completion. No new broad write tool or permission.
- New semantic block = at most six previously observed words; 25s/item is a planning heuristic, not measured recall latency. Revisit after 1d for partial/not recalled and 3d for recalled is a transparent product heuristic, not FSRS. English meaning activity stays within vocabulary stage.
- Separate runtime table prevents typing/chapter/task completion contamination. Atomic fact+cursor, reveal-before-display persistence, owner guard, stopped-run exit, and crash recovery from durable runs are implemented.
- Production inspection correction: execution availability table and RPC **exist**, despite being absent from migration history listing. Do not replay create-table migration blindly. Confirmed columns match main's original contract; no semantic column yet.
- Authenticated real plugin call confirms production toolVersion `coaching-context-v1.2`, no runtime context, existing intent/preferences reads available. No real user learning data saved in repo.
- CI checkpoint caught ES5 Map iterator compatibility; corrected with Array.from. Next CI passed lint/typecheck and exposed a planner fallback regression when no semantic candidates exist; corrected by only selecting a semantic interleave when eligible candidates exist. Local original 20 planner scenarios pass after correction.
- Local targeted semantic measurement/spacing/budget/agent checks pass; cloud adapter 10 scenarios pass. Browser checks added for full Today→semantic→refresh→fact and storage rollback/owner isolation. CI is the general gate.
- CLI telemetry was blocked by automatic review; no approval bypass attempted. Generated migration file retained; use authorized Supabase connector for DDL. No new CLI calls needed.

## Production migration (2026-10-09 00:04 China time)

Applied semantic_recall_agent_contract via authorized Supabase connector, after inspecting existing schema. Validator accepts semantic_recall and continues rejecting duplicate activity/stage keys. Report RPC stays SECURITY INVOKER, anon execute=false, authenticated execute=true, one defaulted parameter preserves old clients. Security Advisor reports only previously documented private-schema deny-by-default/three legacy SECURITY DEFINER findings and leaked-password setting; performance only unused-index notices. No historical data touched. Full-source MCP deployment follows.

## Production MCP v14 — verified

Deployed full 11-file source tree from branch commit `834a30685550412db3c9dbe10c2bd8cfdc00aa70`, replacing the v13 remote-import shim. Function v14 ACTIVE; internal OAuth verification preserved (`verify_jwt=false` at gateway), MCP server 0.8.0, coaching-context-v1.4. No new OAuth authority granted.

Authenticated installed-plugin smoke succeeded: v1.4, semantic read available, intent/preferences reads available, runtime snapshot stale, semantic executor capability unknown, guidance refresh_or_continue_local. This is the correct result for an old/stale website; no false readiness. Only contract/status metadata recorded here, never user event dumps. Discovery endpoint and existing GitHub Pages return HTTP 200. Frontend release is still separate from backend deployment.

## Remaining risks and continuation

1. The runtime availability row is latest-owner-wide, not target-device-bound. Never claim that its counts describe a chosen different device. Next small protocol revision should attach deviceId + client contract version to reports and return bounded per-device selection.
2. Existing Reading draft key is passage/version only (not owner-scoped). Before private Reading content rollout, partition drafts by owner, reset on account changes, reject stale-owner submissions; preserve unowned legacy draft only for its anonymous owner. Reading full orchestration stays gated on a real validated provider; no demo passage auto-recommendation.
3. Existing local export includes the database, but import permits overwrite/clear before domain-level validation. Next ordinary-model task: validate an imported archive into staging, preview owner/version compatibility, then explicit replace/merge with rollback. Do not silently reinterpret or overwrite immutable facts on UUID payload conflict.
4. Word-definition content fingerprints guarantee exact measurement reference, not licensing provenance or correctness of all dictionary senses. Future providers need explicit source/license/private-ownership validation. No trustworthy whole-book denominator added.
5. Semantic runs recover on this device. Synced facts survive device changes; active draft/run transfer across devices is not implemented and must not be claimed.
6. Self-report can be optimistic. Next high-capability task: design a small contextual/meaning-discrimination measure with verified senses/distractors, confidence calibration and separated objective vs subjective evidence. Do not add many modes or apply FSRS before measurement validation.
7. Ordinary continuation: keep PR #49 as the handoff, finish any concrete CI/browser issue, release frontend after gates, verify one user-initiated real semantic session→sync→MCP. Never manufacture personal learning events as a deployment test.
8. Repository plugin metadata is not the installed package: reconcile naming/version from the actual installed artifact before distributing a replacement. No plugin reinstall was performed this session.

## Rejected approaches

- Multiple-choice definitions assembled from arbitrary dictionary distractors: unverified ambiguity creates falsely objective results.
- Free-text semantic auto-grading or LLM grading now: introduces scoring validity/cost/online dependency before a trustworthy rubric.
- Mapping spelling accuracy to semantic mastery or FSRS: measurement mismatch.
- Universal subject/mastery framework and Literature pages: premature domain abstraction; keep versioned envelopes with separate payloads instead.
- Rewriting elastic-v2 or typing: existing safe boundaries can carry an additive activity.
- Automatically using demo Reading as exam content: no credible provider/admission basis.
- Fake stable grades, fatigue, motivation or readiness: no measured basis.

## Experience decisions

One current task remains central on Today. The next semantic block names its activity and why; details stay short. Space/Enter reveals, 1/2/3 rates, Esc pauses when focus is on the study surface; focused buttons/links retain native keyboard behavior. No hotkeys fire during composition/repeat/modifier use. Answer text is absent from DOM before reveal. Real local success says saved; failed transaction keeps the current item and exposes retry. No new decorative animation or timing delay added; existing reduced-motion surfaces reused. Periodic visible-page refresh and refocus keep runtime context useful without hiding the prepared task; owner changes clear and recompute it.

## Verification update

Production v14: unauthenticated POST and invalid-token POST both HTTP 401; discovery HTTP 200. Real authenticated plugin v1.4 smoke passed. Latest CI completed all deterministic/type/build gates and both new semantic browser tests (full loop with reveal refresh and rollback/owner isolation). One existing browser test failed only because the explanatory copy prefix changed; preserved its original natural-language prefix while removing internal jargon. Final CI rerun pending. Local one-time typecheck passed.

`scripts/package-mcp-source.mjs` emits a reproducible 11-file deployment payload including every relative dependency and pinned import map. It performs no deployment, login or secret reading. Use it instead of a remote-import shim; deployment source revision must still be recorded.

## Final checkpoint — completion ledger

- **Implemented / tested:** source commit `674f9629f40ebbf43fe1c4125055464d6fbcfb72`, [Wenyan CI #202](https://github.com/qbjsdsb/wenyan-English/actions/runs/37806947149) fully successful. Original/new deterministic suites, lint, types, production build, original/new browser flows, Pages build and Pages recovery tests all passed. No blanket local test loops. Final subsequent commit only updates documentation.
- **Deployed / smoke verified:** migration and full-source MCP v14; authenticated installed-plugin context v1.4; discovery200, anonymous401, invalid-token401. Retrieved deployed runtime source matches uploaded content byte-for-byte (8 runtime/config files returned; 3 type-only files omitted by archive). No shim remains.
- **Merged:** no. PR #49 deliberately remains Draft as the requested durable continuation surface. Frontend release/merge remains distinct from the already safe additive backend rollout.
- **Real-user verified:** new semantic learning completion→cloud→MCP has not been exercised with the user's actual learning; do not generate synthetic personal history to claim it. Existing real authenticated context read is verified.
- **Blocked:** no code/CI blocker. Local initial registry-mirror downloads were slow; temporary registry substitutions were restored, yarn.lock unchanged. CLI telemetry rejection was handled via authorized connector; no blocked operation remains.
- **Next concrete work:** merge/release the tested frontend when continuing this PR; then user does one real semantic block, allow normal sync, read context semanticEvidence and confirm only actual self-ratings. Keep unknown executor capability until a fresh new-client report. If tool enum metadata is cached, refresh connection metadata; do not grant extra write capability.

All high-value decisions, runnable source, SQL, targeted verification and limitations are in this branch and PR. Literature, objective scoring, FSRS and a broad content system were intentionally not implemented. No private history, tokens, secrets or new copyrighted corpus were committed.


## Quick UI continuation — 2026-10-09

User requested fast visible UI improvements with limited quota. Fresh main `48090e3` contains merged PR #49; branch `astra/quiet-study-experience` starts there. Scope deliberately stays at Today and semantic runner presentation, preserving the mature Typing engine.

Decisions implemented: (1) a newly prepared block is “现在适合做”, recovery is “接着上次的位置”; (2) no-plan first use explains that the main activity is already usable; (3) Today includes semantic attempt facts alongside explicitly labeled spelling metrics, so the new activity leaves a visible trace; (4) an empty upload queue does not prove cloud synchronization; (5) self-rating options have equal visual weight to avoid a design-induced preference for positive ratings; (6) progress reflects committed ratings, not mastery. Larger quiet explanations, responsive primary action, visible keyboard hints and native accessible progress reuse existing theme tokens; no animation on the progress and reduced-motion support for button feedback.

Validation: local typecheck passed; targeted ESLint has no errors, one existing effect ref cleanup warning. Existing semantic accessible button names preserved for browser regression. CI pending at checkpoint; no visual/real-user or deployment claim. No backend or measurement contract change. Ordinary continuation: review CI, inspect Today and semantic screen in both themes, merge when satisfied.


## Vocabulary reliability continuation — 2026-10-09

Fresh main f0e957f includes PR50 and PR51. Fast audit found two silent data/interaction hazards: word persistence errors were swallowed while a fixed timer advanced, and global Enter/Tab/letter handlers captured unrelated controls. Fix waits for word transaction commit before advancing, retains a failed attempt for retry, and gates chapter-result actions on chapter persistence. It keeps the original 260ms feedback floor rather than adding another delay. Word input is frozen once complete, including during slow writes. Keyboard guard respects forms, dialogs, buttons, setting panels and IME; Tab reveal only owns active study. SWR focus/reconnect revalidation is disabled for the current word list to avoid resetting a chapter via a new words array. Manual retry remains.

Targeted browser tests exercise rollback/retry without fake completion and navigation isolation. CI includes them. Ordinary chapter refresh is still chapter-level restart; do not claim exact ordinary-word recovery or all offline dictionaries are available. Further work should prioritize durable normal-chapter cursor/content caching only with content version and truthful chapter-completion semantics. No schema or backend changes in this patch.


Reliability checkpoint results: PR #52; initial four Chromium scenarios passed locally; failed-save start-key isolation passed again after tightening the pending-write boundary. Initial CI run #217 passed lint/typecheck/deterministic gates/build/browser flows, later patch CI pending. Typing progress remains visible when paused and Smart Session vocabulary no longer calls all items “wrong-word review”. A screenshot inspection exposed stale live accuracy before the first one-second tick; Speed now computes accuracy from current counters, and zero-duration WPM is guarded. Local light/dark layout screenshots were inspected, but the container has no Chinese fonts, so Chinese typography is not visually validated. No production deployment or real-user verification claimed.


## Whole-study surfaces continuation — 2026-10-09

Merged PR52 at 7f49d08 after CI219 passed every step. Separate branch polish/whole-study-surfaces carries the following work: public dictionary CacheStorage fallback (8-entry cap, schema validation on both writes/reads, no user material), explicit cached-content feedback; Gallery search and keyboard-safe navigation; explicit exit from review mode when selecting a normal dictionary/chapter/start; same dictionary re-selection preserves chapter; shared high-contrast quiet states and larger navigation controls; records/error-book empty/error recovery; sync busy-state release and native email form.

Important bug discovered: getChapterStats returned no isEmpty=false for populated data, so Analysis rendered its loading branch indefinitely. Corrected and added real IndexedDB fixture regression. Inclusion of the current second avoids hiding an immediately saved record; zero timing cannot produce Infinity. No new facts or fake mastery inferred.

Current scope intentionally excludes exact ordinary-chapter refresh recovery: a cursor alone would break truthful chapter completion and random-order identity. That needs an owner/content/order-bound draft plus saved record references. Existing Smart Session resume remains. Dictionary caching does not make the app shell a PWA. Font was installed only in the temporary QA environment for actual Chinese screenshot inspection, not added as a repository asset/dependency.
