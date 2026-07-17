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
    });
    expect(layout.role).toEqual({
      content: content.role,
      width: 480,
      height: 50,
      x: 765,
      y: 120,
      limit: 29,
      textColor: undefined,
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
});
