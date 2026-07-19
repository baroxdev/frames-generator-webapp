-- The owner-facing edit page (EditCampaignPage.tsx) can now also replace the
-- frame template background image (`background_image_url`), previously only
-- settable at campaign creation time (NewCampaignPage.tsx). Unlike
-- `header_image_url`/`thumbnail_url`, this column is `not null`
-- (0001_campaigns.sql), so the new parameter stays required rather than
-- nullable.
create or replace function public.set_campaign_details(
  campaign_id_input uuid,
  title_input text,
  description_input text,
  thumbnail_url_input text,
  header_image_url_input text,
  background_image_url_input text,
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
      background_image_url = background_image_url_input,
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

-- Old 6-arg overload is superseded by the 7-arg one above; drop it so
-- PostgREST's RPC lookup doesn't have to disambiguate between overloads.
drop function if exists public.set_campaign_details(uuid, text, text, text, text, jsonb);

revoke all on function public.set_campaign_details(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.set_campaign_details(uuid, text, text, text, text, text, jsonb) to authenticated;
