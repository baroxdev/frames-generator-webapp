-- Free-form drag-and-drop layout editor (docs/specs/free-form-layout-editor.md).
--
-- Campaign creation no longer picks a template id from the fixed gallery in
-- `src/templates/gallery.ts` — instead each campaign stores its own
-- `layout`: canvas size (derived from the owner's uploaded background) plus
-- the four box configs (avatar/name/role/message), directly draggable and
-- resizable by the owner. `template_id` is kept (nullable) only so existing
-- rows still resolve to something meaningful and `gallery.ts` stays
-- reusable later — it's no longer written by the app.

alter table public.campaigns
  alter column template_id drop not null,
  add column layout jsonb;

-- Backfill: `layout` is about to become NOT NULL, so every existing row
-- needs a value first. These box coordinates are the same ones in
-- `src/templates/gallery.ts` — duplicated here by hand (same pattern as
-- `campaigns_slug_format` mirroring `SLUG_PATTERN` in campaign.schema.ts,
-- or `create_submission`'s cap mirroring `SUBMISSION_CAP`) since SQL can't
-- import that TypeScript module. If a row's `template_id` doesn't match any
-- of these (shouldn't happen — it's an app-enforced foreign key in
-- practice, just not a real DB constraint), it falls back to
-- modern-portrait's own layout so the NOT NULL constraint below never fails.
update public.campaigns
set layout = case template_id
  when 'classic-diamond' then
    '{"canvas": {"width": 1500, "height": 843},
      "avatarBox": {"top": 263, "left": 189, "width": 352, "height": 352, "shape": "diamond"},
      "nameBox": {"top": 705, "left": 130, "width": 460, "height": 55, "shrinkAt": 30, "textColor": "#fff"},
      "roleBox": {"top": 765, "left": 120, "width": 480, "height": 50, "shrinkAt": 29, "textColor": "#fff"},
      "messageBox": {"top": 150, "left": 680, "width": 750, "height": 560, "textColor": "#1e3a8a"}}'::jsonb
  when 'elegant-centered' then
    '{"canvas": {"width": 1500, "height": 1061},
      "avatarBox": {"top": 322, "left": 57, "width": 440, "height": 440, "shape": "circle"},
      "nameBox": {"top": 825, "left": 25, "width": 520, "height": 60, "shrinkAt": 30, "textColor": "#1e3a8a"},
      "roleBox": {"top": 945, "left": 25, "width": 520, "height": 60, "shrinkAt": 29, "textColor": "#1e3a8a"},
      "messageBox": {"top": 360, "left": 595, "width": 855, "height": 640, "textColor": "#1e3a8a"}}'::jsonb
  when 'minimal-card' then
    '{"canvas": {"width": 1500, "height": 843},
      "avatarBox": {"top": 180, "left": 1020, "width": 320, "height": 320, "shape": "square"},
      "nameBox": {"top": 180, "left": 140, "width": 760, "height": 70, "shrinkAt": 30, "textColor": "#1e3a8a"},
      "roleBox": {"top": 260, "left": 140, "width": 760, "height": 55, "shrinkAt": 29, "textColor": "#1e3a8a"},
      "messageBox": {"top": 340, "left": 140, "width": 760, "height": 290, "textColor": "#1e3a8a"}}'::jsonb
  else
    '{"canvas": {"width": 1500, "height": 843},
      "avatarBox": {"top": 335, "left": 200, "width": 286, "height": 260, "shape": "circle"},
      "nameBox": {"top": 605, "left": 159, "width": 389, "height": 40, "shrinkAt": 29, "textColor": "#ffffff"},
      "roleBox": {"top": 650, "left": 157, "width": 389, "height": 45, "shrinkAt": 20, "textColor": "#ffffff"},
      "messageBox": {"top": 358, "left": 506, "width": 801, "height": 229, "textColor": "#000"}}'::jsonb
end
where layout is null;

alter table public.campaigns
  alter column layout set not null;

-- Owner-scoped write for `layout`, mirroring `create_submission`'s pattern
-- of a narrow `security definer` RPC rather than a generic UPDATE policy: a
-- blanket "owner can update their own row" policy would also let an owner
-- rewrite their own `status` to 'approved', bypassing ticket #5's admin
-- approval gate. This RPC only ever touches the `layout` column.
create or replace function public.set_campaign_layout(campaign_id_input uuid, layout_input jsonb)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_campaign public.campaigns;
begin
  update public.campaigns
  set layout = layout_input
  where id = campaign_id_input
    and owner_id = auth.uid()
  returning * into updated_campaign;

  if updated_campaign is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  return updated_campaign;
end;
$$;

revoke all on function public.set_campaign_layout(uuid, jsonb) from public, anon;
grant execute on function public.set_campaign_layout(uuid, jsonb) to authenticated;
