import {it,expect} from 'vitest';
import {scan,add,move,rename,renameLabel,linkOf} from '../src/document';
import {importPreferences} from '../src/preferences';
import {listItems} from '../src/lists';

it('imports existing theme, switches, wrapping, collapsed link aliases and custom colors',()=>{
  const doc=scan('# [[Folder/Playbook#Intro|介紹]]\n## 第二節\n');
  const key=[...doc.rows.values()][1].key;
  const legacy=encodeURIComponent('介紹')+'[0]';
  const p=importPreferences({titleWrapLength:40,expandListItems:true,showBodyPreview:true,files:{'test.md':{themeId:'muji',collapsedNodeKeys:[legacy],expandedFileNodeKeys:[legacy],nodeAppearances:{[legacy]:{textColor:'#112233',backgroundColor:'#aabbcc'}}}}},'test.md',doc);
  expect(p).toMatchObject({theme:'linen',wrap:40,lists:true,excerpt:true,folded:[key],openLinks:[key],colors:{[key]:{color:'#112233',background:'#aabbcc'}}});
});
it('keeps nested lists and ignores fenced examples',()=>{
  const list=listItems('- 父\n  - 子\n    1. 孫\n- [x] 完成\n```md\n- 不顯示\n```');
  expect(list.map(i=>i.title)).toEqual(['父','[x] 完成']);
  expect(list[0].children[0].children[0].title).toBe('孫');
});
it('moves after a sibling including descendants without deleting other body text',()=>{
  const doc=scan('# A\na\n## B\nb\n# C\nc\n## D\nd\n');
  const rows=[...doc.rows.values()];
  expect(move(doc,rows[1],rows[3],'after')).toBe('# C\nc\n## D\nd\n# A\na\n## B\nb\n');
});
it('supports promoting a child to the parent level',()=>{
  const doc=scan('# A\n## B\nbody\n### C\nc\n# D\nd\n');
  const rows=[...doc.rows.values()];
  const after=scan(move(doc,rows[2],rows[1],'after'));
  expect([...after.rows.values()].map(r=>[r.title,r.depth])).toEqual([['文件',0],['A',1],['B',1],['C',2],['D',1]]);
});
it('duplicate heading identifiers remain unambiguous',()=>{
  const doc=scan('# A\n# A\n## A\n');
  expect(new Set([...doc.rows.keys()]).size).toBe(4);
  expect(()=>rename(doc,doc.root,'x')).toThrow();
  expect(()=>add(doc,doc.root,true)).toThrow();
});
it('keeps encoded links and block links intact',()=>{
  expect(linkOf('[[Folder/筆記#^block|區塊]]')?.fragment).toBe('^block');
  expect(linkOf('[標題](Folder%2FNote.md%23%E7%AB%A0%E7%AF%80)')?.fragment).toBe('章節');
  expect(linkOf('[web](https://example.com)')).toBeNull();
});
it('renames a linked label without losing its destination or section',()=>{
  for(const title of ['[[Folder/Note#Section|舊名稱]]','[舊名稱](Folder%2FNote.md%23Section)']){
    const doc=scan('# '+title+'\n');const result=scan(renameLabel(doc,[...doc.rows.values()][1],'新名稱'));
    const next=linkOf([...result.rows.values()][1].title)!;
    expect(next.label).toBe('新名稱');expect(next.fragment).toBe('Section');
    expect(next.path).toMatch(/^Folder\/Note/);
  }
});
