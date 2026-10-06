# Supabase backend

This directory contains the versioned backend contract for Wenyan English. It is intentionally committed before binding the repository to a specific remote Supabase project.

## First migration

`migrations/20261007_000001_learning_core.sql` creates:

- append-only `public.learning_events`
- RLS policies scoped to `auth.uid()`
- idempotent `ingest_learning_events(jsonb)`
- read-only `get_learning_overview(days)`
- read-only `get_weak_words(days, limit)`

After applying a migration to a real project, run Supabase security and performance advisors before considering the backend ready.

The browser must only receive the project URL and a publishable key. Never commit a secret/service-role key.
