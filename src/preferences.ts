export type Style = { color?: string; background?: string };
export function normalizeWrap(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(6, Math.floor(number)) : 20;
}
export type Preferences = { theme: string; wrap: number; excerpt: boolean; lists: boolean; folded: string[]; colors: Record<string, Style>; selection: string; openLinks: string[] };
export const defaults = (): Preferences => ({ theme: 'mist', wrap: 20, excerpt: false, lists: false, folded: [], colors: {}, selection: 'root', openLinks: [] });
export function legacyKey(key: string) {
  return key === 'document-root' ? 'root' : 'root/' + key.replace(/\[(\d+)\](?=\/|$)/g, ':$1');
}
export function importPreferences(data: Record<string, any>, path: string, doc?: Outline): Preferences {
  const old = data.files?.[path] ?? {};
  const aliases = new Map<string,string>([['document-root','root']]);
  if(doc) {
    const visit = (key: string, prefix: string) => {
      const row = doc.rows.get(key)!; const counts = new Map<string,number>();
      for(const childKey of row.children) {
        const child = doc.rows.get(childKey)!; const title = linkOf(child.title)?.label ?? child.title;
        const count = counts.get(title) ?? 0; counts.set(title,count+1);
        const legacy = `${prefix}${encodeURIComponent(title)}[${count}]`;
        aliases.set(legacy,child.key); visit(child.key,legacy+'/');
      }
    };
    visit('root','');
  }
  const convert = (key:string) => aliases.get(key) ?? legacyKey(key);
  const colors: Record<string, Style> = {};
  for (const [key, value] of Object.entries(old.nodeAppearances ?? {}) as [string, Record<string,string>][]) {
    colors[convert(key)] = { color: value.textColor, background: value.backgroundColor };
  }
  return { ...defaults(), theme: ({clean:'mist',macaron:'pastel',muji:'linen',midnight:'night'} as Record<string,string>)[old.themeId] ?? 'mist',
    wrap: normalizeWrap(data.titleWrapLength), excerpt: !!data.showBodyPreview, lists: !!data.expandListItems,
    folded: (old.collapsedNodeKeys ?? []).map(convert), openLinks: (old.expandedFileNodeKeys ?? []).map(convert), colors };
}
import { linkOf, type Outline } from './document';
