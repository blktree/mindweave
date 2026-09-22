export const languages = { 'zh-TW': '繁體中文', 'zh-CN': '简体中文', en: 'English', ja: '日本語' };
export type Language = keyof typeof languages;
export function language(value: unknown): Language {
  return typeof value === 'string' && Object.hasOwn(languages, value) ? value as Language : 'zh-TW';
}
// Interface strings only; never apply this table to note or node contents.
const rows = [
  ['複製子樹', '复制子树', 'Copy subtree', '子ツリーをコピー'],
  ['剪下子樹', '剪切子树', 'Cut subtree', '子ツリーを切り取り'],
  ['貼上為子節點', '粘贴为子节点', 'Paste as child', '子ノードとして貼り付け'],
  ['語言', '语言', 'Language', '言語'],
  ['切換工具列與提示文字，不會修改筆記內容。', '切换工具栏与提示文字，不会修改笔记内容。', 'Change toolbar labels and tooltips without modifying notes.', 'ツールバーとヒントの言語を変更します。ノートの内容は変更しません。'],
  ['思維導圖主題', '思维导图主题', 'Mind map theme', 'マインドマップのテーマ'],
  ['柔光馬卡龍', '柔光马卡龙', 'Soft pastels', 'やわらかパステル'],
  ['無印暖木', '无印暖木', 'Warm linen', '温もりリネン'],
  ['清透藍白', '清透蓝白', 'Blue mist', 'ブルーミスト'],
  ['深夜靈感', '深夜灵感', 'Midnight inspiration', '真夜中のひらめき'],
  ['文字顏色', '文字颜色', 'Text color', '文字色'],
  ['節點底色', '节点底色', 'Node background', 'ノードの背景色'],
  ['字', '字', 'Text', '文字'],
  ['底', '底', 'Fill', '背景'],
  ['恢復所選節點的主題預設色', '恢复所选节点的主题默认色', 'Reset selected node colors', '選択ノードの色をリセット'],
  ['復原（Ctrl/Cmd + Z）', '撤销（Ctrl/Cmd + Z）', 'Undo (Ctrl/Cmd + Z)', '元に戻す（Ctrl/Cmd + Z）'],
  ['重做（Ctrl/Cmd + Shift + Z）', '重做（Ctrl/Cmd + Shift + Z）', 'Redo (Ctrl/Cmd + Shift + Z)', 'やり直す（Ctrl/Cmd + Shift + Z）'],
  ['縮小導圖', '缩小导图', 'Zoom out', '縮小'],
  ['放大導圖', '放大导图', 'Zoom in', '拡大'],
  ['適配全圖', '适配全图', 'Fit entire map', '全体を表示'],
  ['回到原點', '回到原点', 'Reset view', '表示をリセット'],
  ['全部展開', '全部展开', 'Expand all', 'すべて展開'],
  ['全部收合', '全部折叠', 'Collapse all', 'すべて折りたたむ'],
  ['清單項目', '列表项目', 'List items', 'リスト項目'],
  ['顯示內文', '显示正文', 'Show content', '本文を表示'],
  ['每行', '每行', 'Per line', '1行あたり'],
  ['字元', '字符', 'characters', '文字'],
  ['每行字數', '每行字数', 'Characters per line', '1行の文字数'],
  ['每行至少 6 字，無上限', '每行至少 6 字，无上限', 'At least 6 characters per line, no upper limit', '1行あたり6文字以上、上限なし'],
  ['新增 Markdown 檔案節點', '新增 Markdown 文件节点', 'Add Markdown file node', 'Markdownファイルのノードを追加'],
  ['切回 Markdown', '切回 Markdown', 'Switch to Markdown', 'Markdownに戻る'],
  ['快捷鍵', '快捷键', 'Keyboard shortcuts', 'キーボードショートカット'],
  ['MindWeave 快捷鍵', 'MindWeave 快捷键', 'MindWeave shortcuts', 'MindWeave ショートカット'],
  ['功能', '功能', 'Action', '操作'],
  ['先選取節點，並讓焦點停留在心智圖畫布。文字編輯時使用編輯器本身的快捷鍵。', '先选择节点，并让焦点停留在思维导图画布。编辑文字时使用编辑器自身的快捷键。', 'Select a node and focus the canvas. While editing text, use the editor shortcuts.', 'ノードを選択してキャンバスにフォーカスしてください。文字の編集中はエディターのショートカットを使用します。'],
  ['編輯標題', '编辑标题', 'Edit title', 'タイトルを編集'],
  ['R／雙擊', 'R／双击', 'R / Double-click', 'R／ダブルクリック'],
  ['新增同級', '新增同级', 'Add sibling', '同階層ノードを追加'],
  ['新增子節點', '新增子节点', 'Add child', '子ノードを追加'],
  ['升級節點', '提升节点', 'Promote node', '階層を上げる'],
  ['刪除節點與子樹', '删除节点与子树', 'Delete node and subtree', 'ノードと子ツリーを削除'],
  ['展開／收合', '展开／折叠', 'Expand / collapse', '展開／折りたたみ'],
  ['空白鍵', '空格键', 'Space', 'スペース'],
  ['選取節點', '选择节点', 'Select node', 'ノードを選択'],
  ['方向鍵', '方向键', 'Arrow keys', '矢印キー'],
  ['滑鼠中間滾輪', '鼠标中间滚轮', 'Mouse scroll wheel', 'マウスホイール'],
  ['放大／縮小（以滑鼠位置為中心）', '放大／缩小（以鼠标位置为中心）', 'Zoom in / out around the pointer', 'ポインター位置を中心に拡大／縮小'],
  ['同級排序', '同级排序', 'Reorder siblings', '同階層の並べ替え'],
  ['編輯正文', '编辑正文', 'Edit content', '本文を編集'],
  ['復原', '撤销', 'Undo', '元に戻す'],
  ['重做', '重做', 'Redo', 'やり直す'],
  ['顯示／收合正文', '显示／折叠正文', 'Show / hide content', '本文を表示／非表示'],
  ['若 Command + Space 或 Ctrl + Space 被系統搜尋／輸入法攔截，可拖曳底部分隔線展開或收合正文。', '若 Command + Space 或 Ctrl + Space 被系统搜索／输入法拦截，可拖动底部分隔线展开或折叠正文。', 'If the system or input method intercepts Command/Ctrl + Space, drag the bottom divider to show or hide content.', 'Command/Ctrl + Spaceがシステムや入力方式に使われている場合は、下の区切り線をドラッグして本文を表示・非表示にできます。'],
] as const;
export function translate(text: string, locale: Language): string {
  const row = rows.find(row => (row as readonly string[]).includes(text));
  return row?.[['zh-TW', 'zh-CN', 'en', 'ja'].indexOf(locale)] ?? text;
}
const originalText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();
export function translateControls(root: HTMLElement, locale: Language) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!originalText.has(node) && !rows.some(row => (row as readonly string[]).includes(node!.nodeValue ?? ''))) continue;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? '');
    node.nodeValue = translate(originalText.get(node)!, locale);
  }
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('[title],[aria-label]'))]) {
    if (!originalAttributes.has(el)) originalAttributes.set(el, new Map());
    const originals = originalAttributes.get(el)!;
    for (const attr of ['title', 'aria-label']) {
      const value = el.getAttribute(attr);
      if (value) {
        if (!originals.has(attr)) originals.set(attr, value);
        el.setAttribute(attr, translate(originals.get(attr)!, locale));
      }
    }
  }
}
