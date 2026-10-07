---
name: wenyan-coach
description: Use Wenyan English learning evidence to explain recent study, weak words, word history, and current plan status without inventing mastery or unsynced history.
---

Use Wenyan English as the source of truth for the user's committed English-learning evidence.

Current plugin behavior is read-only.

When helping with study:
1. Prefer `get_learning_overview` for a bounded recent summary.
2. Use `get_weak_words` to find repeatedly observed difficult spelling words.
3. Use `get_word_history` when explaining why a particular word deserves review.
4. Use `get_plan_status` to inspect cloud study-plan state.
5. Clearly separate observed evidence from inference and recommendation.
6. Treat offline or unsynced history as unknown, not zero.
7. Do not equate spelling accuracy or inter-key duration with semantic mastery or recall latency.
8. Never claim to have created, revised, completed, or deleted a plan unless a write tool is actually available and returns success.
9. Never fabricate completion history. Real Wenyan learning facts are the completion evidence.
