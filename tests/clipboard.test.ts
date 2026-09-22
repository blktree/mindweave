import { expect, test } from 'vitest';
import { scan, pasteBranch, pasteText, move, Timeline } from '../src/document';
test('external text creates one child per nonempty line and retains existing text',()=>{
  const doc=scan('# Parent\nbody\n# Other\n');
  const result=pasteText(doc,[...doc.rows.values()][1],'Hello\r\n\r\n世界\nThird');
  const next=scan(result);const parent=[...next.rows.values()][1];
  expect(parent.children.map(k=>next.rows.get(k)!.title)).toEqual(['Hello','世界','Third']);
  expect(result).toContain('# Parent\nbody\n');expect(result).toContain('# Other\n');
  expect(pasteText(doc,doc.root,'   ')).toBe(doc.text);
  const deep=scan('###### Deep\n');
  expect(()=>pasteText(deep,[...deep.rows.values()][1],'text')).toThrow();
});
test('copy preserves body, lists, fences and descendants with adjusted headings',()=>{
  const chunk='# A\nBody\n- list\n```md\n# code\n```\n## Child\ntext\n';
  const doc=scan('# Target\n');
  const result=pasteBranch(doc,[...doc.rows.values()][1],chunk);
  expect(result).toContain('## A\nBody\n- list\n```md\n# code\n```\n### Child\ntext');
  expect(scan(result).rows.size).toBe(4);
});
test('paste rejects excessive depth and handles setext and missing newline',()=>{
  const doc=scan('###### Deep');
  expect(()=>pasteBranch(doc,[...doc.rows.values()][1],'# A\n')).toThrow();
  const root=scan('intro');
  expect(pasteBranch(root,root.root,'Title\n===\nbody')).toBe('intro\n\n# Title\nbody\n');
});
test('cut move is atomic and undoable, rejects descendant destination',()=>{
  const doc=scan('# A\nbody\n## Child\n# B\n');
  const rows=[...doc.rows.values()];
  expect(()=>move(doc,rows[1],rows[2],'child')).toThrow();
  const after=move(doc,rows[1],rows[3],'child');
  const history=new Timeline();history.record(doc.text);
  expect(history.travel(after,false)).toBe(doc.text);
  expect(after).toContain('# B\n## A\nbody\n### Child');
});
