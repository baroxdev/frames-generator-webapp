-- Ticket #5: admin approval gates public campaign visibility.
--
-- An approved campaign's public page must be reachable by anyone, with no
-- auth required, while pending/rejected/suspended campaigns stay invisible
-- to everyone except their owner (already covered by the owner-scoped
-- SELECT policy in 0001_campaigns.sql). Postgres RLS OR's multiple
-- permissive policies for the same command together, so a row becomes
-- selectable if it matches EITHER policy: `auth.uid() = owner_id` (owner,
-- any status) OR `status = 'approved'` (anyone, approved only).
create policy "Anyone can view approved campaigns"
  on public.campaigns for select
  using (status = 'approved');
