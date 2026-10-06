# Upstream policy

## Baseline

- Upstream repository: `RealKai42/qwerty-learner`
- Upstream branch: `master`
- Pinned baseline commit: `1182426f2bd0a28c95302c33f9e19136b1262a70`
- Baseline root tree: `e07040b3055740add91b109400c3ce84e6aef683`
- Baseline date: 2026-09-08
- License: GPL-3.0

The initial Wenyan import was created from the exact upstream Git tree. The repository already existed before the import, so GitHub may not display the platform-level “forked from” relationship even though the source baseline is byte-identical at the Git object level.

## Update policy

Upstream changes are not pulled automatically. For each update:

1. Record the new upstream commit SHA.
2. Compare upstream changes against the last pinned baseline.
3. Import only after Wenyan-specific data, privacy and sync behavior is checked for regressions.
4. Run lint/build and baseline learning-flow tests.
5. Update this file with the accepted upstream SHA.

This avoids silently overwriting Wenyan-specific local storage, sync, privacy, or MCP behavior.
