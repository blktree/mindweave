export interface Section {
  key: string; title: string; depth: number; start: number; body: number;
  bodyEnd: number; end: number; parent: string | null; children: string[];
  headingEnd: number; style: 'atx' | 'setext' | 'root';
}
export interface Outline { text: string; rows: Map<string, Section>; root: Section; eol: string }
export interface Link { path: string; fragment: string; label: string }

export function linkOf(title: string): Link | null {
  const wiki = /^!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(title.trim());
  const md = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(title.trim());
  if (!wiki && !md) return null;
  let target = wiki ? wiki[1] : md![2];
  try { target = decodeURIComponent(target); } catch { /* Retain malformed URLs as text. */ }
  if (/^[a-z]+:\/\//i.test(target)) return null;
  const hash = target.indexOf('#');
  const path = hash < 0 ? target : target.slice(0, hash);
  const fragment = hash < 0 ? '' : target.slice(hash + 1);
  return { path, fragment, label: (wiki ? wiki[2] : md![1]) || fragment || path.split('/').pop()?.replace(/\.md$/, '') || title };
}

export function scan(text: string, name = '文件'): Outline {
  const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)].filter(m => m[0]);
  const root: Section = { key: 'root', title: name, depth: 0, start: 0, body: 0, bodyEnd: text.length,
    end: text.length, headingEnd: 0, parent: null, children: [], style: 'root' };
  const rows = new Map<string, Section>([['root', root]]);
  const stack = [root];
  let fence = ''; let comment = false; let front = text.startsWith('---\n') || text.startsWith('---\r\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i][0]; const line = raw.replace(/[\r\n]+$/, ''); const start = lines[i].index!;
    if (front) {
      if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) { front = false; root.body = start + raw.length; }
      continue;
    }
    if (comment || /^\s*<!--/.test(line)) { comment = !line.includes('-->'); continue; }
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = '';
      continue;
    }
    if (marker) { fence = marker; continue; }
    const atx = /^ {0,3}(#{1,6})(?:\s+(.+?)\s*|\s*)$/.exec(line);
    const underline = lines[i + 1]?.[0].replace(/[\r\n]+$/, '');
    const setext = !atx && line.trim() && !/^(?: {4}|\t|\s*[-*>])/.test(line) && underline ? /^ {0,3}(=+|-+)\s*$/.exec(underline) : null;
    if (!atx && !setext) continue;
    const depth = atx ? atx[1].length : setext![1][0] === '=' ? 1 : 2;
    const title = atx ? (atx[2] || '').replace(/\s+#+\s*$/, '') : line.trim();
    const headingEnd = start + raw.length + (setext ? lines[++i][0].length : 0);
    const previous = [...rows.values()].at(-1)!;
    previous.bodyEnd = start;
    while (stack.length > 1 && stack.at(-1)!.depth >= depth) stack.pop()!.end = start;
    const parent = stack.at(-1)!;
    const occurrence = parent.children.map(k => rows.get(k)!).filter(r => r.title === title).length;
    const key = `${parent.key}/${encodeURIComponent(title)}:${occurrence}`;
    const section: Section = { key, title, depth, start, body: headingEnd, bodyEnd: text.length,
      headingEnd, end: text.length, parent: parent.key, children: [], style: atx ? 'atx' : 'setext' };
    parent.children.push(key); rows.set(key, section); stack.push(section);
  }
  if (front) root.body = text.length;
  return { text, root, rows, eol: text.includes('\r\n') ? '\r\n' : '\n' };
}

export function splice(doc: Outline, start: number, end: number, value: string): string {
  return doc.text.slice(0, start) + value + doc.text.slice(end);
}
export function rename(doc: Outline, row: Section, title: string): string {
  if (!row.depth || /[\r\n]/.test(title) || !title.trim()) throw new Error('請輸入單行標題。');
  return splice(doc, row.start, row.headingEnd, '#'.repeat(row.depth) + ' ' + title.trim() + doc.eol);
}
export function renameLabel(doc: Outline, row: Section, label: string): string {
  if (!linkOf(row.title)) return rename(doc,row,label);
  if (/[\[\]|\r\n]/.test(label) || !label.trim()) throw new Error('連結名稱不能包含中括號、分隔符號或換行。');
  const wiki = /^(!?\[\[)([^\]|]+)(?:\|[^\]]+)?\]\]$/.exec(row.title.trim());
  const md = /^\[[^\]]+\]\(([^)]+)\)$/.exec(row.title.trim());
  return rename(doc,row,wiki ? `${wiki[1]}${wiki[2]}|${label.trim()}]]` : `[${label.trim()}](${md![1]})`);
}
export function add(doc: Outline, row: Section, sibling: boolean, title = '新節點'): string {
  if (sibling && !row.depth) throw new Error('文件根節點沒有同級節點。');
  const depth = sibling ? row.depth : row.depth + 1;
  if (depth > 6) throw new Error('Markdown 最多支援六級標題。');
  const at = row.end;
  return splice(doc, at, at, (at && !doc.text.slice(0, at).endsWith('\n') ? doc.eol : '') +
    doc.eol + '#'.repeat(depth) + ' ' + title + doc.eol + doc.eol);
}
export function move(doc: Outline, row: Section, target: Section, relation: 'child' | 'before' | 'after'): string {
  if (!row.depth || row.key === target.key || (target.depth > 0 && target.start >= row.start && target.start < row.end)) throw new Error('無法移入自己的子樹。');
  if (!target.depth && relation !== 'child') throw new Error('不能移到文件根節點旁。');
  const depth = relation === 'child' ? target.depth + 1 : target.depth;
  const delta = depth - row.depth;
  const descendants = [...doc.rows.values()].filter(r => r.depth && r.start >= row.start && r.start < row.end);
  if (descendants.some(r => r.depth + delta > 6 || r.depth + delta < 1)) throw new Error('移動後超過六級標題。');
  let chunk = doc.text.slice(row.start, row.end);
  for (const r of descendants.reverse()) {
    const start = r.start - row.start; const end = r.headingEnd - row.start;
    chunk = chunk.slice(0, start) + '#'.repeat(r.depth + delta) + ' ' + r.title + doc.eol + chunk.slice(end);
  }
  let at = relation === 'before' ? target.start : target.end;
  const removed = splice(doc, row.start, row.end, '');
  if (at >= row.end) at -= row.end - row.start;
  const prefix = removed.slice(0, at); const suffix = removed.slice(at);
  return prefix + (prefix && !prefix.endsWith('\n') ? doc.eol : '') + chunk +
    (suffix && !chunk.endsWith('\n') ? doc.eol : '') + suffix;
}

export function textTitles(text: string): string[] {
  return text.split(/\r\n|\n|\r/).map(line=>line.trim()).filter(Boolean);
}
export function pasteText(doc: Outline, target: Section, text: string): string {
  const titles = textTitles(text);
  if (!titles.length) return doc.text;
  if (target.depth >= 6) throw new Error('Markdown 最多支援六級標題。');
  const chunk = titles.map(title=>'#'.repeat(target.depth+1)+' '+title+doc.eol+doc.eol).join('');
  return splice(doc,target.end,target.end,(target.end && !doc.text.slice(0,target.end).endsWith('\n') ? doc.eol : '')+doc.eol+chunk);
}
export function pasteBranch(doc: Outline, target: Section, chunk: string): string {
  const source = scan(chunk);
  const headings = [...source.rows.values()].filter(r => r.depth);
  if (!headings.length || source.root.children.length !== 1) throw new Error('請先複製一個標題節點。');
  const delta = target.depth + 1 - headings[0].depth;
  if (headings.some(r => r.depth + delta > 6)) throw new Error('貼上後超過六級標題。');
  for (const row of headings.reverse()) chunk = chunk.slice(0, row.start) + '#'.repeat(row.depth + delta) + ' ' + row.title + doc.eol + chunk.slice(row.headingEnd);
  const at = target.end;
  return splice(doc, at, at, (at && !doc.text.slice(0, at).endsWith('\n') ? doc.eol : '') + doc.eol + chunk + (chunk.endsWith('\n') ? '' : doc.eol));
}

export class Timeline {
  undo: string[] = []; redo: string[] = [];
  record(before: string) { this.undo.push(before); if (this.undo.length > 100) this.undo.shift(); this.redo = []; }
  travel(current: string, forward: boolean): string | undefined {
    const from = forward ? this.redo : this.undo; const to = forward ? this.undo : this.redo;
    const next = from.pop(); if (next !== undefined) to.push(current); return next;
  }
}
