/**
 * Fixed label prefixes an owner can opt a campaign into — see
 * `Template.showFieldPrefix` / `CampaignLayout.showFieldPrefix` in
 * `src/templates/types.ts`. Not owner-customizable text, just an on/off
 * toggle in the layout editor: when on, the visitor's submitted name/role
 * render with these exact strings prepended (e.g. "Họ và tên: Phan Quốc
 * Bảo"), same as the two other curated, fixed-vocabulary choices in this
 * editor (avatar shape, font family).
 */
export const NAME_FIELD_PREFIX = 'Họ và tên: ';
export const ROLE_FIELD_PREFIX = 'Đơn vị: ';
