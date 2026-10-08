# Supabase security model

Updated: 2026-10-08.

This document records the intentional security boundaries behind Wenyan English so future maintenance does not weaken them merely to silence generic Advisor notices.

## 1. Private schema is not a browser data surface

Tables in `wenyan_private` are implementation storage. Browser and OAuth clients do not receive direct CRUD grants to these tables.

Some private tables have RLS enabled with no permissive policies. That is intentional defense in depth: direct authenticated/anonymous table access is denied rather than opened. Do not add broad RLS policies simply to clear an `RLS Enabled No Policy` informational notice.

## 2. Public SECURITY DEFINER RPCs are narrow owner-scoped gateways

`public.wenyan_commit`, `public.wenyan_pull`, and `public.wenyan_oauth_policy` intentionally use `SECURITY DEFINER` because they must cross the private-storage boundary.

They are acceptable only while all of these invariants remain true:

- `anon` and `PUBLIC` cannot execute them;
- only the intended authenticated role can execute them;
- the function has a fixed safe `search_path`;
- the caller identity comes from `auth.uid()` / trusted JWT claims, never user metadata;
- the function calls the owner authorization guard before touching private rows;
- every read/write remains owner-scoped;
- no service-role or secret key is exposed to browser code.

A Supabase Advisor warning about authenticated execution of a `SECURITY DEFINER` function is therefore a review trigger, not an instruction to convert these functions to `SECURITY INVOKER`. Re-check the invariants above before changing them.

## 3. OAuth / MCP Edge Function

`wenyan-english-mcp` intentionally uses `verify_jwt=false` at the Supabase gateway because it is an OAuth resource server and performs its own JWT verification inside the function. The function verifies issuer, audience, expiry, subject, session id, OAuth client id, authenticated role, and rejects anonymous sessions before capability checks.

Do not change this to an unauthenticated handler. Do not replace the internal OAuth validation with trust in request-supplied user identifiers.

## 4. Runtime-derived state is not learning truth

Immutable learning events are the historical source of truth. Ephemeral device state, website command state, Smart Session drafts, and future execution-availability snapshots are operational context only. They must never create or rewrite historical learning completion.

## 5. Advisor handling

Production review on 2026-10-08 established:

- the missing covering index for `wenyan_private.config(owner_id)` was a real performance finding and was fixed with `wenyan_private_config_owner_id_idx`;
- unused-index notices are informational and should not cause indexes to be dropped without representative workload evidence;
- the three private-table RLS/no-policy notices are intentional deny-by-default boundaries;
- the three authenticated `SECURITY DEFINER` notices correspond to the reviewed owner-scoped gateway functions above;
- leaked-password protection remains an Auth/project configuration item and should be enabled when available for the project plan.

After any DDL, auth, RLS, or privileged-function change, re-run Supabase Security and Performance Advisors and verify the affected RPC with a real authenticated request.
