# Spec: Free-form drag-and-drop layout editor for campaigns

**Status:** Draft — reflects a decision made in-session that reverses issue #1's
documented "Out of scope: free-form drag-and-drop frame layout editor" for v1.
The GitHub tracker (issue #1, #4) is deliberately **not** being updated to
match this decision yet — this file is the only record of it for now.

## 1. Problem / goal

Today, creating a campaign means picking one of a handful of pre-designed
`Template`s (`src/templates/gallery.ts`) with hardcoded avatar/name/role/
message box coordinates baked in at a fixed canvas size (mostly 1500×843).
The owner uploads a background but has no control over where their content
sits on it beyond that fixed choice.

This replaces the template-picker step of campaign creation with a
drag-and-drop editor: the owner uploads their own background, the system
proposes a sensible default box layout scaled to that image, and the owner
freely repositions/resizes each box before saving. Re-editing later (not
just at creation time) is in scope.

`gallery.ts` and the template-gallery UI (`TemplateGallery` component) are
**not deleted** — they stay in the codebase for later reference or reuse,
just unused by the campaign creation/edit flow after this change.

## 2. Scope

**In scope:**
- Replacing the "pick a template" step in `NewCampaignPage` with: upload
  background → drag-edit the 4 boxes over it → submit.
- A new "edit campaign" flow letting an owner reopen and re-adjust an
  existing campaign's box layout (position, size, avatar shape, text
  colors) at any time after creation.
- A per-campaign `layout` (canvas size + 4 box configs) replacing the
  `template_id` lookup as the source of render truth for that campaign.
- Avatar shape choice limited to `circle` | `square` (diamond dropped from
  the new flow's shape picker — `diamond` still exists as a valid value for
  old templates/rows, just not offered as a new choice here).
- A color picker per text box (name/role/message), since a fixed default
  text color can't be assumed readable against an arbitrary uploaded
  background.

**Out of scope (this phase):**
- Any change to the existing `gallery.ts` templates or the components that
  render them elsewhere (they're left alone).
- Changing the background image as part of a layout re-edit — re-edit only
  adjusts box position/size/shape/color against the campaign's *existing*
  background. Replacing the background image itself is a separate future
  capability, not built here. *(Flagging this as an assumption — confirm.)*
- Minimum box size enforcement — resizing to any size (including
  degenerate/tiny) is allowed; not treated as a problem worth guarding
  against in this phase.
- Overlap prevention between boxes — freely allowed, no validation.
- Rotation, multi-select, alignment guides/snapping.
- Updating GitHub issue #1/#4/#8 to reflect this decision.

## 3. Data model

### `campaigns` table changes (new migration)

```sql
alter table public.campaigns
  add column layout jsonb not null,
  alter column template_id drop not null;
```

- `template_id` becomes nullable and stops being written by the new
  creation flow. Kept only for old rows and any future reuse of
  `gallery.ts`.
- `layout` shape (mirrors `Template`'s box-config fields, minus the
  template-identity fields that don't apply per-campaign):

  ```ts
  type CampaignLayout = {
    canvas: { width: number; height: number };
    avatarBox: { top: number; left: number; width: number; height: number; shape: 'circle' | 'square' };
    nameBox: { top: number; left: number; width: number; height: number; textColor: string; shrinkAt?: number };
    roleBox: { top: number; left: number; width: number; height: number; textColor: string; shrinkAt?: number };
    messageBox: { top: number; left: number; width: number; height: number; textColor: string; shrinkAt?: number };
  };
  ```

- Since `layout` is `not null`, the migration must backfill any existing
  rows before adding the constraint: for each existing row, look up its
  `template_id` in the (duplicated, server-side) box coordinates and write
  that as `layout`, canvas taken from that template's `canvas` size.
  (Confirmed: no real/seed data to worry about, but the migration does this
  unconditionally for correctness regardless of what's actually in the
  table when it runs.)

### Write path — mirrors `set_campaign_visibility`'s pattern

A generic "owner can update their own row" RLS policy is **not** added —
same reasoning as the visibility RPC (0004_campaign_visibility_toggle.sql):
it would let an owner also rewrite `status`, bypassing admin approval.
Instead, a narrow RPC:

```sql
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
```

Structural validation of `layout_input` (shape/keys/number ranges) happens
client-side via a Zod schema before the RPC call, same as every other
mutation in this codebase (`campaign.schema.ts`, `submission.schema.ts`)
— the RPC itself doesn't re-validate box shape, only ownership.

`createCampaign` also changes: it now accepts `layout` instead of
`templateId`, writing straight into the new column at insert time (no RPC
needed there since insert is already owner-scoped by the existing INSERT
policy).

## 4. Default layout generation

On uploading a background image, before the owner has dragged anything:

1. Read the image's natural `width`/`height` (e.g. via an offscreen
   `Image()` load) → this becomes `layout.canvas`.
2. Compute each box as a **percentage** of that canvas, derived from
   `modernPortrait`'s existing proportions (its absolute pixel values
   against its own 1500×843 canvas, converted to fractions), then multiply
   back out to concrete pixels for this campaign's actual canvas size.
   Roughly: avatar circle ~15% from top/left, sized ~20% of canvas width;
   name/role stacked beneath it; message box filling the right ~60% of the
   canvas. Exact fractions to be pinned down by reading `modernPortrait`'s
   real numbers in `gallery.ts` at implementation time.
3. Text color defaults: reuse `modernPortrait`'s text colors as the initial
   picker value (owner can repick immediately if unreadable against their
   background).
4. Avatar shape default: `circle`.

This is a one-time computation on background upload (or background
replacement, if that's ever added) — once the owner starts dragging, their
edits are the new source of truth; re-uploading a *different* background
during initial creation (before submit) recomputes defaults from scratch.

## 5. Editor architecture

**Rendering split — revised after live testing.**

The initially-planned "option B" (`PrintArea` underneath as the DOM/CSS
visual truth, a transparent `react-konva` overlay on top providing only
drag/resize handles) is **not what got built**. It was implemented once,
but breaking it out into a background job and reviewing it via mocked unit
tests only (never actually opened in a browser) let a basic bug ship: the
editor rendered at literal native pixel size with zero responsive scaling,
so any realistically-sized upload (e.g. 5555×3124) overflowed the page
entirely, unusable. Once caught by manual testing, the call was made to
drop the hybrid rather than patch it — see the decision below.

**What's actually built instead:** the editor renders **entirely in
Konva** — background image, and a placeholder box + label per field
(avatar/name/role/message) — with `PrintArea` dropped from the editor
altogether.

- `PrintArea` (existing DOM/CSS component, **unchanged**) is reserved
  exclusively for the actual visitor-facing campaign page
  (`CampaignPublicPage`) and the real export via `compositeFrameToBlob` —
  it is *not* used by the editor at all anymore.
- The editor's `<Stage>`/`<Layer>` renders a `Konva.Image` for the
  background, a `Konva.Rect` + `Konva.Text` placeholder pair per box, and
  a `Konva.Transformer` bound to whichever box is selected.
- Fit-to-container: the `Stage`'s own `scaleX`/`scaleY` are driven by a
  `ResizeObserver` on the wrapping div (`scale = containerWidth /
  canvas.width`). Konva accounts for its own scale when mapping pointer
  coordinates, so drag/resize math stays in plain, unscaled canvas-pixel
  space regardless of how small the stage is drawn on screen — verified by
  manually dragging/resizing/toggling shape on a 5555×3124 upload in a real
  browser.
- On `dragMove`/`transform` (continuous, not just on release), the
  corresponding box's `{top, left, width, height}` is written into React
  state, so the Konva-rendered box (and its label) tracks the pointer live.
- Bounds: each `Konva.Rect`/`Transformer` clamps fully within the canvas
  bounds during both drag and resize (`dragBoundFunc` / `boundBoxFunc`).
  No minimum size, no overlap prevention (see Scope).

**Trade-off accepted, not solved here:** the editor's placeholder text is
plain Konva `Text` (a generic font), not the real `Name`/`Role`/`Message`
DOM components — so it no longer pixel-matches `PrintArea`'s actual
fonts/styling the way "option B" would have. The owner sees accurate
*position/size* against the real background, not a font-accurate preview;
closing that visual gap is a follow-up, not addressed by this change.

**Properties panel:** shape/color controls for the selected box are shown
in a sidebar next to the canvas (Figma-style contextual properties panel),
not inline text below it.

**Library:** `react-konva` + `konva` (chosen over `react-rnd`: 6.4k/14.6k
stars vs 4.3k, 3/17 open issues vs 182, actively pushed within the last
week vs `react-rnd`'s known-but-workaroundable Vite `process` shim issue).
`Konva.Transformer` is a built-in fit for "drag + resize a rectangle,"
which is exactly this use case.

**Non-drag controls, next to each box (or in a small side panel):**
- Avatar box: shape toggle (circle/square).
- Name/role/message boxes: color picker (antd `ColorPicker` — already an
  antd-based codebase) for `textColor`.

## 6. User-facing flow

### Creation (`NewCampaignPage`, modified)
1. Enter slug (unchanged).
2. Upload background image (unchanged UI, `Upload.Dragger`).
3. Once a background file is selected: the "Mẫu khung" `Form.Item`
   (`TemplateGallery`) is removed from this page; in its place, the
   Konva-rendered editor appears — the uploaded background + placeholder
   content at the computed default layout, draggable/resizable, with
   shape/color controls in a properties sidebar.
4. Submit: `createCampaign` now sends `{ slug, layout, backgroundImageUrl }`
   instead of `{ slug, templateId, backgroundImageUrl }`.

### Re-edit (new)
- A new entry point (e.g. an "Edit layout" action from `CampaignsPage`'s
  table, or a dedicated `/campaigns/:id/edit` route — exact placement is
  an implementation detail, not decided here) opens the same editor
  component pre-populated from the campaign's existing `backgroundImageUrl`
  and `layout` (no default-layout computation — that only ever runs
  against a freshly-uploaded background).
- Saving calls the `set_campaign_layout` RPC via a new
  `updateCampaignLayoutMutationOptions()`, then invalidates that
  campaign's cached query entries (`campaignKeys.list()` and
  `campaignKeys.bySlug(slug)`).
- Background image itself is not editable from this flow (see Out of
  scope).

### Public/gallery rendering (`CampaignPublicPage`, ticket #8's gallery, etc.)
- Anywhere `getTemplateById(campaign.templateId)` is currently used to
  build the `template` object passed into `PrintArea`, that becomes
  `campaign.layout` directly (already in the right shape) — no lookup
  needed, since the layout is now stored on the row itself rather than
  referenced by id.

## 7. Testing implications

- `campaign.schema.ts`: replace/extend `createCampaignSchema`'s
  `templateId` field with a `layout` schema (Zod object mirroring
  `CampaignLayout`, with the same box-shape validation).
- `campaign.service.ts` / `.test.ts`: `createCampaign` params and mocked
  insert payloads change from `templateId` to `layout`; add
  `updateCampaignLayout` (or similarly named) method + tests, mirroring
  the existing `setVisibility` pattern once that lands.
- New migration gets backfill logic covered by... (no automated migration
  tests exist in this repo today — same as prior migrations, verified
  manually against Supabase's SQL editor per existing convention).
- New editor component(s) need interaction tests (drag/resize simulate via
  Konva's test utilities or by directly invoking the state-update
  callbacks the `Transformer` would call) — exact test strategy TBD at
  implementation time.

## 8. Open items / assumptions to confirm before implementation

1. Re-edit doesn't allow changing the background image — only layout.
   Confirm this is acceptable, or should re-edit also allow re-upload?
2. ~~Exact placement of the "edit layout" entry point~~ — **resolved:**
   `CampaignsPage`'s table has a "Chỉnh sửa bố cục" row action linking to
   `/campaigns/:id/edit` (`EditCampaignLayoutPage`).
3. ~~Live-drag vs. commit-on-release~~ — **resolved, and the rendering
   target changed:** the editor updates live on every `dragMove`/
   `transform` frame, but against Konva-rendered placeholders, not
   `PrintArea` — see the revised §5.
4. Whether `shrinkAt` (auto font-shrink threshold) stays a fixed constant
   per box type or becomes owner-configurable — assumed fixed constant,
   not exposed in the editor UI, consistent with "no minimum box size" not
   being a concern the owner needs to manage directly either.
5. **New:** closing the visual gap between the editor's Konva placeholders
   and `PrintArea`'s real fonts/styling (see §5's trade-off) — not
   addressed by this change, follow-up work.
