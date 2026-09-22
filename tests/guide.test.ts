import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { scan, add, rename, splice } from '../src/document';

const read = (path: string) => readFileSync(resolve(path), 'utf8');
describe('User guide examples', () => {
  it('builds the trip hierarchy using the documented Tab/Enter sequence', () => {
    let doc = scan('', '週末旅行 Weekend Trip');
    const row = (title: string) => [...doc.rows.values()].find(r => r.title === title)!;
    const create = (parent: string, sibling: boolean, title: string) => {
      doc = scan(add(doc, parent === 'root' ? doc.root : row(parent), sibling, title), doc.root.title);
    };
    create('root', false, '目的地 Destination');
    create('目的地 Destination', false, '台南 Tainan');
    create('目的地 Destination', true, '行程 Activities');
    create('行程 Activities', false, '古蹟巡禮 Heritage Walk');
    create('古蹟巡禮 Heritage Walk', true, '在地美食 Local Food');
    create('行程 Activities', true, '預算 Budget');
    doc = scan(rename(doc, row('預算 Budget'), '費用預算 Trip Budget'), doc.root.title);
    const example = scan(read('docs/examples/01-weekend-trip.md'), doc.root.title);
    expect([...doc.rows.values()].map(r => [r.title, r.depth, r.parent]))
      .toEqual([...example.rows.values()].map(r => [r.title, r.depth, r.parent]));
    for (const entry of example.rows.values()) {
      if (!entry.depth) continue;
      const body = example.text.slice(entry.body, entry.bodyEnd).trim();
      if (body) {
        const target = row(entry.title);
        doc = scan(splice(doc, target.body, target.bodyEnd, '\n' + body + '\n\n'), doc.root.title);
      }
    }
    expect(doc.text.replace(/\n+/g, '\n').trim()).toBe(example.text.replace(/\n+/g, '\n').trim());
  });
  it('parses the existing note and adds an FAQ under Further Ideas', () => {
    const original = read('docs/examples/02-website-redesign.md');
    const doc = scan(original, '網站改版 Website Redesign');
    expect(doc.text).toBe(original);
    expect([...doc.rows.values()].map(r => r.depth)).toEqual([0, 1, 2, 2, 3, 3, 2, 2]);
    const parent = [...doc.rows.values()].find(r => r.title === '延伸想法 Further Ideas')!;
    const next = scan(add(doc, parent, false, '常見問題 FAQ'));
    const faq = [...next.rows.values()].find(r => r.title === '常見問題 FAQ')!;
    expect(faq.depth).toBe(3);
    expect(faq.parent).toBe(parent.key);
    expect(original).toContain('- 盤點頁面 Audit pages');
  });
  it('keeps copyable Markdown blocks synchronized and local links valid', () => {
    const guide = read('docs/USER_GUIDE.md');
    const blocks = [...guide.matchAll(/```markdown\n([\s\S]*?)```/g)].map(m => m[1].trim());
    expect(blocks).toEqual(['01-weekend-trip', '02-website-redesign'].map(name => read(`docs/examples/${name}.md`).trim()));
    for (const path of ['README.md', 'docs/USER_GUIDE.md']) {
      for (const match of read(path).matchAll(/\]\(([^)]+)\)/g)) {
        const link = match[1];
        if (/^https?:|^#/.test(link)) continue;
        expect(existsSync(resolve(dirname(path), link)), `${path}: ${link}`).toBe(true);
      }
    }
  });
});
