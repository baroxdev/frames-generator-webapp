-- Campaigns table (ticket #4: "Create & list campaigns").
--
-- Conceptual schema per the parent epic (#1): owner (FK to auth user),
-- unique slug, template reference, background image URL (R2), YouTube
-- music URL (nullable, set by a later ticket), visibility, status,
-- submission_count. `submissions` (ticket #6) is added in a later
-- migration once that ticket lands.
--
-- Run this against your Supabase project (SQL editor, or `supabase db push`
-- if you're using the CLI locally) before deploying the app.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  template_id text not null,
  background_image_url text not null,
  music_url text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  submission_count integer not null default 0,
  created_at timestamptz not null default now(),
  -- Slugs are used as URL path segments (`/<slug>`); keep them predictable
  -- and safe without relying on app-layer validation alone.
  constraint campaigns_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists campaigns_owner_id_idx on public.campaigns (owner_id);

alter table public.campaigns enable row level security;

-- Owners can only see and manage their own campaigns. Public read access to
-- approved+public campaigns is added by ticket #8 (visibility toggle +
-- public gallery), which needs its own policy — not added here so a
-- pending/private campaign never leaks before that ticket lands.
create policy "Owners can view their own campaigns"
  on public.campaigns for select
  using (auth.uid() = owner_id);

create policy "Owners can create their own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = owner_id);

-- Slug availability must be checkable by any authenticated owner before they
-- submit a new campaign, even though the row-level SELECT policy above only
-- lets an owner see their own rows. `security definer` runs this function
-- with the privileges of its owner (bypassing RLS for this narrow check
-- only) so uniqueness is checked platform-wide; the underlying `slug`
-- unique constraint is still the authoritative guard at insert time.
create or replace function public.is_slug_available(slug_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.campaigns where slug = slug_input);
$$;

revoke all on function public.is_slug_available(text) from public;
grant execute on function public.is_slug_available(text) to authenticated;
