import { describe, expect, it } from 'vitest';

import { resolveTemplateLayout } from '../resolveTemplate';
import { Template } from '../types';

const fixtureTemplate: Template = {
  id: 'fixture',
  name: 'Fixture template',
  description: 'Used only by resolveTemplate tests',
  background: 'fixture-bg.png',
  canvas: { width: 1500, height: 843 },
  avatarBox: { top: 116, left: 242, width: 498, height: 498, shape: 'diamond' },
  nameBox: { top: 705, left: 130, width: 460, height: 55, shrinkAt: 30, textColor: '#fff' },
  roleBox: { top: 765, left: 120, width: 480, height: 50, shrinkAt: 29 },
  messageBox: { top: 150, left: 680, width: 750, height: 560, textColor: '#1e3a8a' },
};

const content = {
  avatar: 'blob:avatar',
  fullName: 'Nguyễn Văn A',
  role: 'Bí thư Đoàn',
  message: 'Chúc mừng đại hội!',
};

describe('resolveTemplateLayout', () => {
  it('resolves the avatar box to the coordinates defined by the template, not any hardcoded values', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.avatar).toEqual({
      content: content.avatar,
      width: 498,
      height: 498,
      x: 116, // template's avatarBox.top
      y: 242, // template's avatarBox.left
      shape: 'diamond',
    });
  });

  it('resolves the name box independently of the role box', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.name).toEqual({
      content: content.fullName,
      width: 460,
      height: 55,
      x: 705,
      y: 130,
      limit: 30,
      textColor: '#fff',
      fontFamily: 'Be Vietnam Pro',
    });
    expect(layout.role).toEqual({
      content: content.role,
      width: 480,
      height: 50,
      x: 765,
      y: 120,
      limit: 29,
      textColor: undefined,
      fontFamily: 'Be Vietnam Pro',
    });
  });

  it('resolves the message box from the template, carrying the submission text through untouched', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.message).toEqual({
      content: content.message,
      width: 750,
      height: 560,
      x: 150,
      y: 680,
      textColor: '#1e3a8a',
      fontFamily: 'Be Vietnam Pro',
    });
  });

  it('carries the canvas size and background through from the template', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.canvas).toEqual({ width: 1500, height: 843 });
    expect(layout.background).toBe('fixture-bg.png');
  });

  it('produces a different layout for a different template given the same content', () => {
    const otherTemplate: Template = {
      ...fixtureTemplate,
      id: 'other',
      avatarBox: { top: 60, left: 590, width: 320, height: 320, shape: 'circle' },
    };

    const layoutA = resolveTemplateLayout(fixtureTemplate, content);
    const layoutB = resolveTemplateLayout(otherTemplate, content);

    expect(layoutA.avatar).not.toEqual(layoutB.avatar);
    expect(layoutB.avatar).toEqual({
      content: content.avatar,
      width: 320,
      height: 320,
      x: 60,
      y: 590,
      shape: 'circle',
    });
  });

  it('leaves content fields undefined when the submission has not filled them in yet (preview/default state)', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, {});

    expect(layout.avatar.content).toBeUndefined();
    expect(layout.name.content).toBeUndefined();
    expect(layout.role.content).toBeUndefined();
    expect(layout.message.content).toBeUndefined();
  });

  it("falls back to DEFAULT_FONT_FAMILY when the template has no explicit fontFamily", () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.name.fontFamily).toBe('Be Vietnam Pro');
    expect(layout.role.fontFamily).toBe('Be Vietnam Pro');
    expect(layout.message.fontFamily).toBe('Be Vietnam Pro');
  });

  it("uses the template's own fontFamily for name/role/message when set, the same one font for all three", () => {
    const layout = resolveTemplateLayout({ ...fixtureTemplate, fontFamily: 'Playfair Display' }, content);

    expect(layout.name.fontFamily).toBe('Playfair Display');
    expect(layout.role.fontFamily).toBe('Playfair Display');
    expect(layout.message.fontFamily).toBe('Playfair Display');
  });

  it("carries the template's own customFont through to name/role/message, the same one for all three", () => {
    const customFont = {
      family: 'custom-brand-font-ab12',
      url: 'https://cdn.example.com/campaign-fonts/owner/brand-font.woff2',
      format: 'woff2' as const,
      originalFileName: 'brand-font.woff2',
    };
    const layout = resolveTemplateLayout(
      { ...fixtureTemplate, fontFamily: customFont.family, customFont },
      content,
    );

    expect(layout.name.customFont).toEqual(customFont);
    expect(layout.role.customFont).toEqual(customFont);
    expect(layout.message.customFont).toEqual(customFont);
  });

  it('leaves customFont undefined when the template has no uploaded font', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.name.customFont).toBeUndefined();
    expect(layout.role.customFont).toBeUndefined();
    expect(layout.message.customFont).toBeUndefined();
  });

  it("carries the template's showFieldPrefix through to name/role only, not message", () => {
    const layout = resolveTemplateLayout(
      { ...fixtureTemplate, showFieldPrefix: true },
      content,
    );

    expect(layout.name.showPrefix).toBe(true);
    expect(layout.role.showPrefix).toBe(true);
    expect(layout.message.showPrefix).toBeUndefined();
  });

  it('leaves showPrefix undefined when the template has no showFieldPrefix set', () => {
    const layout = resolveTemplateLayout(fixtureTemplate, content);

    expect(layout.name.showPrefix).toBeUndefined();
    expect(layout.role.showPrefix).toBeUndefined();
  });
});
