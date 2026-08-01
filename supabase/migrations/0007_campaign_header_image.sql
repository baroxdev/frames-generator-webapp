-- Campaign header image: a free-aspect-ratio banner shown at the top of the
-- public campaign page (src/pages/public/CampaignPublicPage.tsx), owner
-- uploadable, distinct from `thumbnail_url` (social-share/OG card) and
-- `background_image_url` (the frame template background). No aspect-ratio
-- constraint is enforced anywhere — the public page renders it at its
-- natural ratio — so this is just a nullable URL column, same shape as
-- `thumbnail_url`.
alter table public.campaigns
  add column header_image_url text;

-- The owner-facing edit page now saves SEO fields, layout, and the header
-- image together from one form (see EditCampaignPage.tsx) instead of three
-- separate pages/saves, so this replaces per-concern writes
-- (set_campaign_seo, set_campaign_layout — 0006/0004) with a single RPC
-- that updates all of them in one statement. Those two RPCs are left in
-- place, just unused going forward, rather than dropped — no call site
-- depends on removing them, and dropping a `security definer` function is
-- a one-way door if something still references it.
--
-- Same owner-scoped pattern as set_campaign_seo/set_campaign_layout: a
-- security definer RPC narrowly scoped to `owner_id = auth.uid()` rather
-- than a blanket UPDATE policy, so an owner can never rewrite their own
-- `status` and bypass admin approval (see 0004_campaign_layout.sql).
create or replace function public.set_campaign_details(
  campaign_id_input uuid,
  title_input text,
  description_input text,
  thumbnail_url_input text,
  header_image_url_input text,
  layout_input jsonb
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_campaign public.campaigns;
begin
  update public.campaigns
  set title = title_input,
      description = description_input,
      thumbnail_url = thumbnail_url_input,
      header_image_url = header_image_url_input,
      layout = layout_input
  where id = campaign_id_input
    and owner_id = auth.uid()
  returning * into updated_campaign;

  if updated_campaign is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  return updated_campaign;
end;
$$;

revoke all on function public.set_campaign_details(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.set_campaign_details(uuid, text, text, text, text, jsonb) to authenticated;
