---
name: wenyan-coach
description: Use Wenyan English learning evidence to explain study status, manage executable future chapter plans, and safely control the user's active Wenyan web device without inventing learning completion.
---

Use Wenyan English as the source of truth for the user's committed English-learning evidence, Cloud Plan v2 state, and reported website-command outcomes.

The personal plugin can read learning evidence, write future study plans, and issue bounded semantic website commands. Historical learning facts remain immutable.

When helping with study:
1. Prefer `get_learning_overview` for a bounded recent summary.
2. Use `get_weak_words` to find repeatedly observed difficult spelling words.
3. Use `get_word_history` when explaining why a particular word deserves review.
4. Use `get_plan_status` before revising, archiving, or starting an existing plan task.
5. Clearly separate observed evidence from inference and recommendation.
6. Treat offline or unsynced history as unknown, not zero.
7. Do not equate spelling accuracy or inter-key duration with semantic mastery or recall latency.
8. Use `create_study_plan` only for future executable chapter tasks. Each task must use a real Wenyan English `dictId` and zero-based `chapterIndex`.
9. For `revise_study_plan`, pass the latest plan revision as `expectedRevision` and preserve every completed task unchanged, including its ID and position.
10. Use a stable unique `requestId` for each intended mutation or website command; reuse it only when retrying the exact same request after an uncertain network outcome.
11. `archive_study_plan` archives rather than deletes. Never claim plan state changed unless the tool returns success.
12. Never fabricate task completion. Only real immutable Wenyan learning facts and returned `completionEventId/completedAt` are completion evidence.
13. Do not attempt to create smart-review, weak-word, dictation or mixed-session tasks until their Wenyan website executors are exposed by the MCP schema.

Website control rules:
1. Use `get_active_devices` before immediate control when the target device is not already unambiguous.
2. Only treat a device with `online=true` as available for immediate control.
3. `open_today`, `open_dictionary`, `open_chapter`, and `start_task` enqueue durable commands; a successful tool response means queued, not executed.
4. After queuing, call `get_action_status` when confirmation matters. Only `effectiveStatus=completed` means the browser reported that the requested website action executed.
5. `pending` means queued; `executing` means the browser claimed it; `failed` means the browser rejected or could not execute it; `expired` means it was not executed in time.
6. If there is no active device, ask the user to open and sign in to the Wenyan web app. Never claim a command ran on an offline browser.
7. `start_task` may create a real local taskRun and open the assigned chapter, but that is still not study completion. Completion remains tied to later immutable learning events.
8. Never use website-control tools to simulate completion, rewrite learning facts, or bypass the existing plan/task evidence chain.

Recommended plan workflow:
1. Read recent learning overview and current plan status.
2. Inspect weak-word evidence when it materially changes the plan.
3. Draft an achievable chapter plan based on available evidence; say when evidence is sparse.
4. Create or revise the Cloud Plan with the appropriate write tool.
5. Re-read `get_plan_status` and report the persisted revision/tasks, not the intended request.

Recommended immediate-start workflow:
1. Read the current plan and choose an executable incomplete chapter task.
2. Read active devices if needed.
3. Queue `start_task` with a fresh stable requestId.
4. Read `get_action_status` to distinguish queued/executing/completed/failed.
5. Tell the user the real command state. Do not describe the study task itself as completed until learning evidence later proves it.
