import { describe, it, expect } from 'vitest';
import { scan, rename, add, move, linkOf, Timeline } from '../src/document';
import { Camera, arrange, type Box } from '../src/geometry';

describe('Markdown transactions', () => {
  it('preserves frontmatter, fenced examples and CRLF outside the edited heading', () => {
    const source = '---\r\ntitle: title\r\n---\r\nintro\r\n# A\r\n```md\r\n# example\r\n```\r\n## B\r\nbody\r\n';
    const doc = scan(source); const a = [...doc.rows.values()].find(r => r.title === 'A')!;
    expect(doc.rows.size).toBe(3);
    expect(source.slice(doc.root.body, doc.root.bodyEnd)).toBe('intro\r\n');
    expect(rename(doc, a, '修改')).toBe(source.replace('# A', '# 修改'));
  });
  it('supports setext titles without treating an empty horizontal rule as a heading', () => {
    const doc = scan('Title\n=====\nbody\n\n---\n\n## Child\ntext');
    expect([...doc.rows.values()].map(r => r.title)).toEqual(['文件', 'Title', 'Child']);
  });
  it('preserves aliases and section destinations', () => {
    expect(linkOf('[[Folder/Playbook#Section|我的章節]]')).toEqual({ path: 'Folder/Playbook', fragment: 'Section', label: '我的章節' });
    expect(linkOf('[測試](Folder%2FPlaybook.md%23Section)')).toEqual({ path: 'Folder/Playbook.md', fragment: 'Section', label: '測試' });
  });
  it('moves the complete subtree and updates only actual heading depths', () => {
    const doc = scan('# A\nbody A\n## B\n```\n# code\n```\n# C\nbody C\n');
    const a = [...doc.rows.values()].find(r => r.title === 'A')!; const c = [...doc.rows.values()].find(r => r.title === 'C')!;
    const result = move(doc, a, c, 'child');
    expect(result).toBe('# C\nbody C\n## A\nbody A\n### B\n```\n# code\n```\n');
  });
  it('rejects cycles and excessive nesting', () => {
    const doc = scan('# A\n## B\n###### C\n'); const rows = [...doc.rows.values()];
    expect(() => move(doc, rows[1], rows[2], 'child')).toThrow();
    expect(() => add(doc, rows[3], false)).toThrow();
  });
  it('adds H1 siblings without changing original content', () => {
    const doc = scan('# A\nbody'); const result = add(doc, [...doc.rows.values()][1], true);
    expect(result.startsWith(doc.text)).toBe(true);
    expect([...scan(result).rows.values()].filter(r => r.depth === 1)).toHaveLength(2);
  });
  it('undo and redo restore exact source, including whitespace', () => {
    const t = new Timeline(); t.record(' # A\r\n\r\n');
    expect(t.travel('# B', false)).toBe(' # A\r\n\r\n');
    expect(t.travel(' # A\r\n\r\n', true)).toBe('# B');
    t.record('# B'); expect(t.redo).toEqual([]);
  });
});

describe('single camera coordinates', () => {
  it('keeps arbitrary pointer anchors fixed through 1000 zoom operations', () => {
    const camera = new Camera(); camera.fit(1500, 5000, 1000, 800);
    for (let i = 0; i < 1000; i++) {
      const pointer = { x: (i * 31) % 997, y: (i * 19) % 797 };
      const point = { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale };
      camera.zoom(i % 2 ? 0.83 : 1.19, pointer.x, pointer.y);
      expect(camera.screen(point.x, point.y).x).toBeCloseTo(pointer.x, 8);
      expect(camera.screen(point.x, point.y).y).toBeCloseTo(pointer.y, 8);
    }
  });
  it('fits all content and aligns the root side to 24px', () => {
    const camera = new Camera(); camera.fit(1700, 3200, 1100, 900);
    expect(camera.x).toBe(24); expect(camera.screen(1700, 3200).y).toBeLessThanOrEqual(876);
  });
  it('places sibling subtrees without overlap', () => {
    const node = (key: string, children: Box[] = []): Box => ({ key, children, width: 100, height: 30, x: 0, y: 0 });
    const a = node('a', [node('aa'), node('ab')]); const b = node('b'); const root = node('root', [a, b]);
    const result = arrange(root);
    expect(b.y).toBeGreaterThan(a.children[1].y + 30);
    expect(a.x).toBe(220); expect(result.width).toBe(540);
  });
});
