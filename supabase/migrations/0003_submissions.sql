-- Submissions table (ticket #6: "Visitor submission flow: generate & download
-- the tribute frame"), plus the atomic RPC that enforces the per-campaign
-- 5,000-submission cap.
--
-- Visitors are never signed in (no Supabase Auth session), so every write
-- here happens through a service-role Edge Function
-- (supabase/functions/submit-tribute) rather than directly from the
-- browser — that's also why `create_submission` is REVOKEd from
-- `anon`/`authenticated` below: it must only run after that function has
-- already verified the caller's Turnstile token, never on its own.

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 25),
  role text not null check (char_length(role) between 3 and 36),
  message text not null check (char_length(message) between 10 and 400),
  -- The final composited tribute frame (background + avatar + text),
  -- produced client-side and uploaded as one image — never the visitor's
  -- raw avatar photo, which is never uploaded or stored anywhere.
  image_url text not null check (image_url ~ '^https://'),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_campaign_id_idx on public.submissions (campaign_id);

alter table public.submissions enable row level security;

-- Deliberately no policies: RLS enabled with zero policies default-denies
-- both `anon` and `authenticated`. Only the service-role key (used
-- exclusively by the submit-tribute Edge Function) can read or write this
-- table. #6 has no requirement for any client-side read of submission rows
-- (no owner-facing submissions list is in scope), so this is intentional —
-- do not "fix" it by adding a public policy without a real read requirement
-- driving it.

-- Atomically enforces the 5,000-submission cap (mirrored client-side as
-- SUBMISSION_CAP in src/pages/public/CampaignPublicPage.tsx, kept in sync by
-- hand — that copy only drives a proactive UI check; this is the
-- authoritative enforcement) and inserts the row in one
-- transaction, so a failed insert can never leave `submission_count`
-- incremented with no matching row (the increment and the insert must not
-- be two separate round-trips). `UPDATE ... WHERE submission_count < 5000`
-- is race-safe under Postgres's default read-committed isolation: the row
-- lock plus EvalPlanQual re-check on a concurrent update means the count
-- can never exceed 5000, even under concurrent submissions.
create or replace function public.create_submission(
  campaign_id_input uuid,
  full_name_input text,
  role_input text,
  message_input text,
  image_url_input text
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
  new_submission public.submissions;
begin
  update public.campaigns
  set submission_count = submission_count + 1
  where id = campaign_id_input
    and status = 'approved'
    and submission_count < 5000
  returning submission_count into updated_count;

  if updated_count is null then
    raise exception 'campaign_full' using errcode = 'P0001';
  end if;

  insert into public.submissions (campaign_id, full_name, role, message, image_url, consented_at)
  values (campaign_id_input, full_name_input, role_input, message_input, image_url_input, now())
  returning * into new_submission;

  return new_submission;
end;
$$;

revoke all on function public.create_submission(uuid, text, text, text, text) from public, anon, authenticated;
