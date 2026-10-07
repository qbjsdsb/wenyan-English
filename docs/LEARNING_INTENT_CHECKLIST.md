# Learning Intent v1 merge checklist

- [x] Production migrations applied through FK index.
- [x] RLS enabled on public intent tables.
- [x] Explicit Data API grants present.
- [x] RPCs are SECURITY INVOKER.
- [x] OAuth mutation path gated by `coach:auto_adjust`.
- [x] Idempotency and optimistic revision locking implemented.
- [x] Same-scope concurrent writes serialized.
- [x] PL/pgSQL `FOUND` ordering bug fixed.
- [x] New foreign-key Advisor hint addressed.
- [x] No production test intent rows left behind.
- [ ] GitHub CI green on PR head.
- [ ] Real OAuth mutation smoke test after MCP tools are deployed.
