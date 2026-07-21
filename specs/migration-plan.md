# Migration Plan: Supabase (Postgres + Auth + Edge Functions) → Cloudflare (D1 + Workers)

Status: draft, not started. Written 2026-07-21. Triggered by projected DB growth
(31 MB → ~630 MB at 110k submissions) that would exceed Supabase's free 500 MB
tier around ~90k submissions; D1's free tier (5 GB) has far more headroom.

## 0. Why, and the real cost of doing it

Storage headroom is the trigger, but it's not the hard part. The hard part is
that Supabase gives us four things beyond "a table": Postgres RLS, Auth
(JWT + `auth.users`), `security definer` RPCs (i.e. transactional stored
procedures), and Edge Functions with those wired in for free. D1 (SQLite) has
none of these — every one of them has to be reimplemented as application code
inside a Cloudflare Worker. This is a full backend rewrite, not a `pg_dump` /
`.sqlite` swap. Treat the storage-cost argument as necessary but not
sufficient — do a final go/no-go check against the effort below before
starting.

## 1. Current state (as of this branch)

**Schema** — two tables, all in `supabase/migrations/0001`–`0008`:

- `public.campaigns` — owner_id (FK → `auth.users`), slug, template_id
  (nullable, legacy), background_image_url, music_url, visibility, status,
  submission_count, layout (jsonb), title/description/thumbnail_url,
  header_image_url, created_at.
- `public.submissions` — campaign_id (FK → campaigns), full_name, role,
  message, image_url, consented_at, created_at. RLS default-deny except one
  owner-scoped SELECT policy (0005).

**RPCs (`security definer`, transactional, revoked from anon/authenticated)**:

- `is_slug_available(slug)` — read-only uniqueness check (0001).
- `create_submission(...)` — atomically caps at 200,000/campaign, increments
  `campaigns.submission_count`, inserts the row (0003).
- `set_campaign_layout`, `set_campaign_seo` — superseded, left in place,
  no longer called (0004, 0006).
- `set_campaign_details(...)` — current single RPC the owner-edit form calls;
  7-arg version updates title/description/thumbnail/header/background/layout
  in one statement, owner-scoped via `auth.uid()` (0008).
- `delete_submission(id)` — deletes a row, decrements `submission_count`
  (0005).

**Auth**: email/password only via `supabase-js` (`auth.signUp` /
`signInWithPassword`, Turnstile-gated sign-up, password reset flow). Session
is client-side only (`onAuthStateChange` → TanStack Query cache in
`src/hooks/useAuthSession.ts`). No server-side JWT verification exists today
outside what Supabase's own Edge Function runtime does implicitly.

**Edge Functions** (`supabase/functions/`), all holding R2 S3-compatible
credentials via `aws4fetch`:

- `submit-tribute` — verifies Turnstile, HEAD-checks the uploaded R2 object,
  calls `create_submission`. Anonymous-facing.
- `delete-submission` — verifies the caller's Supabase session/JWT belongs to
  the campaign owner, calls `delete_submission`, then deletes the R2 object.
- `r2-presigned-upload` — owner-only, presigned PUT for campaign background.
- `submission-presigned-upload` — anonymous, presigned PUT for a visitor's
  composited tribute image.

**Frontend access pattern**: goes through a thin service/query layer, not
scattered raw calls — `src/services/{auth,campaign,submission,storage}.service.ts`
+ `src/queries/auth.queries.ts`, on top of `src/lib/supabase-client.ts` (browser)
and `src/lib/supabase-server-client.ts` (SSR loaders, anon key, RLS-reliant).

**Cloudflare today**: R2 storage only, reached via signed S3 requests *from
Supabase Edge Functions* — there is no Workers runtime in this repo yet
(no `wrangler.toml`/`.jsonc`, no `src/worker/`). This migration is greenfield
on the Workers side.

## 2. Target architecture

- **D1** replaces Postgres. One database, schema ported to SQLite dialect.
- **A Cloudflare Worker** replaces both PostgREST (the implicit REST API
  `supabase-js` talks to) and the four Edge Functions. Same routes, same
  request/response shapes where practical, so the frontend service layer
  changes as little as possible.
- **R2 access moves from signed S3 requests to a native R2 binding** in the
  Worker (`env.TRIBUTE_BUCKET.put(...)`) — simpler and faster than
  `aws4fetch`, since the Worker and bucket are already in the same account.
  This is optional relative to the DB migration but should be done at the
  same time since the Edge Functions are being rewritten anyway.
- **Auth**: replace `supabase-js` client auth with a hand-rolled
  email/password flow — Worker issues a signed session token (e.g. HMAC or
  `jose` JWT) on login, stored as an httpOnly cookie; Worker middleware
  verifies it on every owner-scoped route. Passwords hashed with
  `scrypt`/`bcrypt`-equivalent available in Workers (`bcryptjs` or Web Crypto
  PBKDF2 — pick one during implementation, not in this doc).
- RLS is replaced by **explicit `WHERE owner_id = ?` checks in Worker route
  handlers**, mirroring exactly what each RPC already does today — this is
  mechanical, not a redesign, since every current policy is already scoped to
  a single `auth.uid() = owner_id` check.

## 3. Schema port: Postgres → SQLite (D1)

Key dialect differences to handle, table by table:

| Postgres (current) | D1/SQLite equivalent |
|---|---|
| `uuid primary key default gen_random_uuid()` | `text primary key` — generate the UUID in the Worker (`crypto.randomUUID()`) before insert; D1 has no server-side UUID default |
| `timestamptz not null default now()` | `text not null default (datetime('now'))` (ISO 8601 string) or integer unix-epoch; pick one, use consistently |
| `jsonb` (`layout` column) | `text`, JSON-serialized; parse/stringify at the Worker boundary |
| `check (char_length(x) between a and b)` | same `check` syntax works in SQLite — port as-is |
| `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` | SQLite has no native regex; either enforce this only in the Worker (schema.ts already validates it client-side) or register a custom regex function — recommend Worker-only enforcement to avoid D1-specific extensions |
| `references ... on delete cascade` | supported in SQLite, but D1 requires `PRAGMA foreign_keys = ON` per-connection — confirm current D1 default before relying on cascade |
| `security definer` RPC functions | no equivalent — becomes a Worker function that runs the same multi-statement logic inside a D1 [batch/transaction](use D1's `batch()` API for atomicity) |
| RLS policies | no equivalent — becomes an explicit filter/check in the Worker handler, as above |

`campaigns.submission_count` race-safety (currently
`UPDATE ... WHERE submission_count < 200000 RETURNING`, relying on Postgres
row locks + EvalPlanQual): D1 doesn't have the same MVCC guarantees under
concurrent writers from multiple Worker isolates. Needs its own design spike
before implementation — likely candidates: D1's `batch()` with a conditional
`UPDATE ... WHERE submission_count < ?` (single statement, still atomic at
the SQL level, just needs verification under D1's actual concurrency model),
or moving the counter to a Durable Object if D1-level atomicity turns out to
be insufficient under load. Do not assume parity with Postgres here — verify.

## 4. Migration phases

1. **Spike**: prototype the submission-count race condition fix and the
   Worker auth/session flow in isolation (small standalone Worker + D1 db),
   before touching the real schema. This is the highest-risk unknown.
2. **Schema + data migration script**: write the SQLite DDL, then a one-off
   script to export every row from Supabase Postgres and bulk-insert into D1
   (via `wrangler d1 execute` batch inserts or the D1 HTTP API). Run against
   a copy first, diff row counts before/after.
3. **Worker API layer**: implement routes 1:1 with current RPCs/Edge
   Functions (`create_submission`, `delete_submission`,
   `set_campaign_details`, `is_slug_available`, the four Edge Function
   equivalents), reusing the existing frontend service-layer contracts so
   `src/services/*.service.ts` only needs their fetch target swapped, not
   their call signatures.
4. **Auth cutover**: implement Worker-side email/password + session cookie,
   port existing Supabase Auth users (requires either a password reset
   broadcast — Supabase doesn't expose password hashes for re-use — or a
   dual-auth transition window). This needs its own decision before
   implementation: forcing a reset email vs. running both auth systems
   temporarily.
5. **R2 binding cutover**: swap `aws4fetch` signed requests for native
   `env.BUCKET` binding calls in the new Worker.
6. **Frontend cutover**: point `src/lib/supabase-client.ts` /
   `supabase-server-client.ts` callers at the new Worker endpoints; remove
   the Supabase client dependency once nothing calls it.
7. **Parallel run + cutover**: run both backends briefly (feature-flagged or
   by route), verify submission flow and owner dashboard end-to-end in a real
   browser (per this project's existing rule — mocked tests aren't proof for
   this kind of flow), then decommission Supabase.

## 5. Open decisions to make before implementation starts

- Auth token scheme (JWT vs. opaque session ID) and where sessions are
  persisted (D1 table vs. Durable Object vs. stateless JWT).
- Existing-user password migration strategy (forced reset vs. dual-auth
  window).
- Whether `submission_count`'s concurrency guarantee needs a Durable Object,
  or D1's `batch()` is sufficient — resolve via the phase-1 spike, not
  assumption.
- Whether to keep Supabase around read-only as a rollback path for some
  period after cutover, or migrate + decommission in one motion.

## 6. Explicitly out of scope for this doc

- Exact SQLite DDL statements (write during phase 2, not speculatively here).
- Worker route handler code.
- Cost modeling beyond the storage-tier trigger already covered in prior
  conversation (D1/Workers pricing at 110k+ rows is favorable but not
  re-derived here).

## Housekeeping note (unrelated to this plan, flagged during research)

Two stale worktrees exist at `.claude/worktrees/agent-aa878d150b0ceb60a` and
`.claude/worktrees/agent-ab7698854c524d303`, containing what looks like
divergent/parallel auth-related changes (a different `supabase-client.ts`
under `src/queries/auth.queries.ts`). Worth checking whether either has
unmerged work before starting this migration, so it isn't accidentally
duplicated or lost.
