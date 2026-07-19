-- Campaign SEO / social-share metadata: title, description, thumbnail.
--
-- Optional, owner-editable fields for search engines and share-preview
-- cards (Facebook, etc.) — the app falls back to the slug / a generic
-- description / the campaign's own background image when these are unset
-- (see src/utils/resolveCampaignSeo.ts), so all three are nullable and no
-- backfill is needed for existing rows. Actually wiring these into the
-- Open Graph tags a crawler sees is a separate follow-up (this SPA serves
-- one static index.html today — that needs server-side/edge injection,
-- not just storing the data) — this migration only adds somewhere for the
-- owner to put the values.
alter table public.campaigns
  add column title text,
  add column description text,
  add column thumbnail_url text,
  add constraint campaigns_title_length check (title is null or char_length(title) <= 100),
  add constraint campaigns_description_length check (description is null or char_length(description) <= 300);

-- Owner-scoped write for these three columns, mirroring
-- set_campaign_layout's pattern (0004_campaign_layout.sql) rather than a
-- blanket "owner can update their own row" policy — same reason: that
-- would also let an owner rewrite their own `status`, bypassing ticket
-- #5's admin approval gate.
create or replace function public.set_campaign_seo(
  campaign_id_input uuid,
  title_input text,
  description_input text,
  thumbnail_url_input text
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
      thumbnail_url = thumbnail_url_input
  where id = campaign_id_input
    and owner_id = auth.uid()
  returning * into updated_campaign;

  if updated_campaign is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  return updated_campaign;
end;
$$;

revoke all on function public.set_campaign_seo(uuid, text, text, text) from public, anon;
grant execute on function public.set_campaign_seo(uuid, text, text, text) to authenticated;
