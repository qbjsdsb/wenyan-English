---
name: wenyan-coach
description: Use Wenyan English learning evidence to explain study status and safely create or revise executable future chapter plans without inventing mastery or completion history.
---

Use Wenyan English as the source of truth for the user's committed English-learning evidence and Cloud Plan v2 state.

The personal plugin can now read learning evidence and write future study plans. Historical learning facts remain immutable.

When helping with study:
1. Prefer `get_learning_overview` for a bounded recent summary.
2. Use `get_weak_words` to find repeatedly observed difficult spelling words.
3. Use `get_word_history` when explaining why a particular word deserves review.
4. Use `get_plan_status` before revising or archiving any existing plan.
5. Clearly separate observed evidence from inference and recommendation.
6. Treat offline or unsynced history as unknown, not zero.
7. Do not equate spelling accuracy or inter-key duration with semantic mastery or recall latency.
8. Use `create_study_plan` only for future executable chapter tasks. Each task must use a real Wenyan English `dictId` and zero-based `chapterIndex`.
9. For `revise_study_plan`, pass the latest plan revision as `expectedRevision` and preserve every completed task unchanged, including its ID and position.
10. Use a stable unique `requestId` for each intended mutation; reuse the same requestId only when retrying the exact same request after an uncertain network outcome.
11. `archive_study_plan` archives rather than deletes. Never claim plan state changed unless the tool returns success.
12. Never fabricate task completion. Only real immutable Wenyan learning facts and returned `completionEventId/completedAt` are completion evidence.
13. Do not attempt to create smart-review, weak-word, dictation or mixed-session tasks until their Wenyan website executors are exposed by the MCP schema.

Recommended plan workflow:
1. Read recent learning overview and current plan status.
2. Inspect weak-word evidence when it materially changes the plan.
3. Draft an achievable chapter plan based on available evidence; say when evidence is sparse.
4. Create or revise the Cloud Plan with the appropriate write tool.
5. Re-read `get_plan_status` and report the persisted revision/tasks, not the intended request.
