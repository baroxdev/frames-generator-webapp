-- Ticket #7: owner's private submissions dashboard.
--
-- 0003_submissions.sql deliberately left `submissions` with zero RLS
-- policies (default-deny) because #6 had no owner-facing read requirement.
-- This ticket adds exactly one: an owner can SELECT the submissions that
-- belong to their own campaigns (via a join against `campaigns.owner_id`,
-- the same ownership check `set_campaign_layout` uses). No INSERT/UPDATE/
-- DELETE policy is added — deleting a submission also has to remove its R2
-- avatar object, which needs the service-role credentials only an Edge
-- Function holds (see supabase/functions/delete-submission), so deletion
-- stays entirely server-side rather than exposed as a client-writable RLS
-- policy.
create policy "Owners can view their campaign submissions"
  on public.submissions for select
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = submissions.campaign_id
        and c.owner_id = auth.uid()
    )
  );

-- Deletes one submission and keeps `campaigns.submission_count` in sync in
-- the same transaction (mirroring create_submission's atomicity), so a
-- crash between the two can never under/over count. Ownership is verified
-- by the caller (the delete-submission Edge Function, which resolves the
-- caller's user id from their own JWT and checks it against the
-- submission's campaign) before this ever runs — this function trusts its
-- caller completely, the same way create_submission trusts submit-tribute
-- to have already verified Turnstile, which is why both are revoked from
-- every role but service_role.
create or replace function public.delete_submission(submission_id_input uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_submission public.submissions;
begin
  delete from public.submissions
  where id = submission_id_input
  returning * into deleted_submission;

  if deleted_submission is null then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  update public.campaigns
  set submission_count = greatest(submission_count - 1, 0)
  where id = deleted_submission.campaign_id;

  return deleted_submission;
end;
$$;

revoke all on function public.delete_submission(uuid) from public, anon, authenticated;
