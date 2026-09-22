export type Style = { color?: string; background?: string };
export function normalizeWrap(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(6, Math.floor(number)) : 20;
}
export type Preferences = { theme: string; wrap: number; excerpt: boolean; lists: boolean; folded: string[]; colors: Record<string, Style>; selection: string; openLinks: string[] };
export const defaults = (): Preferences => ({ theme: 'mist', wrap: 20, excerpt: false, lists: false, folded: [], colors: {}, selection: 'root', openLinks: [] });
