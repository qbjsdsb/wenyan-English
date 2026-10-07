# Learning Intent real OAuth smoke test

Run only through a real authenticated Wenyan OAuth/MCP session after the intent tools are deployed.

1. `get_learning_intents`
2. `revise_learning_intent` with scope `session`, `expectedRevision=0`, a short expiry and a unique stable requestId.
3. Retry the exact same requestId and payload; response must be identical.
4. Revise the same scope with `expectedRevision=1` and a new requestId.
5. Send one invalid constraint shape and verify rejection without mutation.
6. `clear_learning_intent` with the current revision and a new requestId.
7. `get_learning_intents` again and verify the test session scope is not active.

Never claim this smoke test passed until it has run against a genuine OAuth session. Synthetic JWT impersonation is intentionally not used.
