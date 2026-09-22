export interface ListItem { index: number; title: string; children: ListItem[] }
export function listItems(text: string): ListItem[] {
  const result: ListItem[] = []; const stack: { indent: number; item: ListItem }[] = [];
  let fence = '';
  for (const [index, line] of text.split('\n').entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) { if (!fence) fence = marker; else if(marker[0]===fence[0]&&marker.length>=fence.length) fence=''; continue; }
    if(fence) continue;
    const match = /^(\s*)(?:[-+*]|\d+[.)])\s+(.+)$/.exec(line); if(!match) continue;
    const indent = match[1].replace(/\t/g,'    ').length;
    while(stack.length && stack.at(-1)!.indent>=indent) stack.pop();
    const item = {index,title:match[2],children:[]} as ListItem;
    (stack.at(-1)?.item.children ?? result).push(item); stack.push({indent,item});
  }
  return result;
}
