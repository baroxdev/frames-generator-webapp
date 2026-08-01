import { describe, expect, it } from 'vitest';

import { effectiveAvatarBox, findOverlappingBoxes } from '../boxOverlap';
import { getTemplateById, getTemplateGallery } from '../gallery';
import { resolveTemplateLayout } from '../resolveTemplate';

const templates = getTemplateGallery();

describe('template gallery', () => {
  it('has at least 3 templates', () => {
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every template a unique id', () => {
    const ids = templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is genuine design variety: no two templates share both the same background and the same box layout', () => {
    const signatures = templates.map((template) =>
      JSON.stringify({
        background: template.background,
        avatarBox: template.avatarBox,
        nameBox: template.nameBox,
        roleBox: template.roleBox,
        messageBox: template.messageBox,
      })
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it.each(templates.map((template) => [template.id, template] as const))(
    'template "%s" renders its four submission fields without any overlapping',
    (_id, template) => {
      const layout = resolveTemplateLayout(template, {
        avatar: 'avatar.jpg',
        fullName: 'Nguyễn Văn A',
        role: 'Bí thư Đoàn phường',
        message: 'Xin gửi lời tri ân sâu sắc nhất tới các thế hệ đi trước.',
      });

      // The avatar box goes through effectiveAvatarBox: a 'diamond' avatar
      // is rendered rotated 45deg (see Avatar.tsx), so its true painted
      // footprint is larger than the box declared in the template — using
      // the raw box here would let a diamond avatar visually collide with a
      // neighboring field while this check still reported "no overlap".
      const overlaps = findOverlappingBoxes([
        { name: 'avatar', box: effectiveAvatarBox(template.avatarBox) },
        { name: 'name', box: { top: layout.name.x, left: layout.name.y, width: layout.name.width, height: layout.name.height } },
        { name: 'role', box: { top: layout.role.x, left: layout.role.y, width: layout.role.width, height: layout.role.height } },
        { name: 'message', box: { top: layout.message.x, left: layout.message.y, width: layout.message.width, height: layout.message.height } },
      ]);

      expect(overlaps).toEqual([]);
    }
  );

  it.each(templates.map((template) => [template.id, template] as const))(
    'template "%s" keeps every box fully inside its own canvas',
    (_id, template) => {
      const boxes = [
        effectiveAvatarBox(template.avatarBox),
        template.nameBox,
        template.roleBox,
        template.messageBox,
      ];
      for (const box of boxes) {
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top + box.height).toBeLessThanOrEqual(template.canvas.height);
        expect(box.left + box.width).toBeLessThanOrEqual(template.canvas.width);
      }
    }
  );

  it('finds a template by id', () => {
    const first = templates[0];
    expect(getTemplateById(first.id)).toEqual(first);
  });

  it('returns undefined for an unknown template id', () => {
    expect(getTemplateById('does-not-exist')).toBeUndefined();
  });
});
