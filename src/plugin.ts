import { Plugin, PluginSettingTab, Setting, FileView, TFile, WorkspaceLeaf, Notice, MarkdownRenderer, Component, Modal, FuzzySuggestModal, Scope, setIcon } from 'obsidian';
import { scan, linkOf, renameLabel, add, move, splice, pasteBranch, pasteText, textTitles, Timeline, type Section, type Outline } from './document';
import { Camera, arrange, type Box } from './geometry';
import { SectionEditor, sectionProjection } from './body-editor';
import { defaults, normalizeWrap, type Preferences } from './preferences';
import { listItems, type ListItem } from './lists';
import { language, languages, translate, translateControls, type Language } from './language';

const TYPE = 'mindweave-view';
interface Display { key: string; title: string; source: Section; file: TFile; outline: Outline; children: Display[]; readonly: boolean }

export default class MindWeave extends Plugin {
  branchClipboard?: { chunk: string; path: string; key: string; original: string; cut: boolean };
  preferences: Record<string, Preferences> = {};
  displaySettings = { wrap:20, excerpt:false, lists:false };
  language: Language = 'zh-TW';
  async onload() {
    const saved = await this.loadData(); this.preferences = saved?.preferences ?? {};
    this.language = language(saved?.language);
    this.addSettingTab(new MindWeaveSettings(this));
    this.displaySettings = saved?.displaySettings ?? {wrap:20,excerpt:false,lists:false};
    this.registerEditorExtension(sectionProjection);
    this.registerView(TYPE, leaf => new MapView(leaf, this));
    this.addRibbonIcon('lightbulb', '開啟 MindWeave', () => { void this.open(); }).addClass('mwi-bulb');
    this.addCommand({ id: 'open', name: '開啟思維導圖', callback: () => { void this.open(); } });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle('以 MindWeave 開啟').setIcon('lightbulb').onClick(() => { void this.open(file); }));
    }));
  }
  async open(file = this.app.workspace.getActiveFile()) {
    if (!file || file.extension !== 'md') { new Notice('請先開啟 Markdown 筆記。'); return; }
    const existing = this.app.workspace.getLeavesOfType(TYPE).find(l => (l.view as MapView).file === file);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: TYPE, state: { file: file.path }, active: true });
  }
  async setLanguage(locale: Language) {
    this.language = locale;
    await this.persist();
    for (const leaf of this.app.workspace.getLeavesOfType(TYPE)) {
      const toolbar = (leaf.view as MapView).contentEl.querySelector<HTMLElement>('.mwi-toolbar');
      if (toolbar) translateControls(toolbar, locale);
    }
  }
  async persist() { await this.saveData({ preferences: this.preferences, displaySettings:this.displaySettings, language:this.language }); }
}

class MindWeaveSettings extends PluginSettingTab {
  constructor(private owner: MindWeave) { super(owner.app, owner); }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl('h2', {text:'MindWeave'});
    new Setting(this.containerEl)
      .setName(translate('語言', this.owner.language))
      .setDesc(translate('切換工具列與提示文字，不會修改筆記內容。', this.owner.language))
      .addDropdown(dropdown => dropdown.addOptions(languages).setValue(this.owner.language).onChange(async value => {
        await this.owner.setLanguage(language(value)); this.display();
      }));
  }
}

class FilePicker extends FuzzySuggestModal<TFile> {
  constructor(private owner: MindWeave, private choose: (f: TFile) => void) { super(owner.app); this.setPlaceholder('搜尋要連結的筆記'); }
  getItems() { return this.owner.app.vault.getMarkdownFiles(); }
  getItemText(f: TFile) { return f.path; }
  onChooseItem(f: TFile) { this.choose(f); }
}

class MapView extends FileView {
  private plugin: MindWeave;
  private doc = scan('');
  private preferences = defaults();
  private selected = 'root';
  private history = new Timeline();
  private camera = new Camera();
  private canvas!: HTMLElement;
  private world!: HTMLElement;
  private pane!: HTMLElement;
  private splitter!: HTMLElement;
  private zoomLabel!: HTMLElement;
  private displays = new Map<string, Display>();
  private boxes = new Map<string, Box>();
  private expanded = new Map<string, Display[]>();
  private preview = new Component();
  private previewVersion = 0;
  private loadVersion = 0;
  private busy = false;
  private size = { width: 1, height: 1 };
  private paneHeight = 0;
  private suppressClick = false;
  private bodyEditor: SectionEditor | null = null;
  private nativeEditor: SectionEditor | null = null;
  private titleEditor: HTMLElement | null = null;
  private uiHistory = new Map<string, Preferences>();
  private colorPickers: HTMLInputElement[] = [];
  constructor(leaf: WorkspaceLeaf, plugin: MindWeave) {
    super(leaf); this.plugin = plugin; this.addChild(this.preview);
    this.scope = new Scope(this.app.scope);
    this.scope.register(['Mod'], 'Enter', () => {
      if (this.canvas?.contains(this.contentEl.ownerDocument.activeElement)) {
        void this.editBody().catch(error=>new Notice(String(error))); return false;
      }
    });
    this.scope.register(['Mod'], 's', () => {
      if (this.bodyEditor) { void this.bodyEditor.save().catch(() => {}); return false; }
    });
  }
  getViewType() { return TYPE; }
  getDisplayText() { return this.file ? `MindWeave · ${this.file.basename}` : 'MindWeave'; }
  getIcon() { return 'lightbulb'; }
  async onOpen() {
    this.registerDomEvent(this.contentEl.ownerDocument, 'keydown', e => {
      const target = e.target as Element;
      const doc = this.contentEl.ownerDocument;
      if (this.app.workspace.activeLeaf?.view !== this || e.defaultPrevented ||
          target.closest('.modal-container,input,textarea,select,button,a,[contenteditable="true"],.cm-editor')) return;
      // Rebuilding the canvas can leave focus on the page instead of the canvas.
      if (this.contentEl.contains(target) || target === doc.body || target === doc.documentElement) this.key(e);
    });
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file === this.file && !this.busy && !this.bodyEditor) void this.reload(false);
      else if (file !== this.file && file !== this.bodyEditor?.file && [...this.displays.values()].some(d=>d.file===file)) {
        this.expanded.clear(); this.draw(); void this.restoreLinks();
      }
    }));
    this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
      const preferences=this.plugin.preferences[oldPath];
      if(preferences){this.plugin.preferences[file.path]=preferences;delete this.plugin.preferences[oldPath];void this.plugin.persist();}
      if(file===this.file) {this.doc.root.title=file.name.replace(/\.md$/,'');this.shell();this.draw();}
    }));
  }
  async onLoadFile(file: TFile) {
    const outline = scan(await this.app.vault.read(file),file.basename);
    this.preferences = {...structuredClone(this.plugin.preferences[file.path] ?? defaults()),...this.plugin.displaySettings};
    this.selected = this.preferences.selection; this.history = new Timeline(); this.expanded.clear(); this.paneHeight = 0;
    await this.reload(true);
    this.fit();
  }
  async onUnloadFile() { await this.closeBody(); if(this.nativeEditor){this.nativeEditor.ready=false;this.removeChild(this.nativeEditor);this.nativeEditor=null;} this.loadVersion++; this.previewVersion++; this.preview.unload(); }
  private async reload(initial: boolean) {
    if (!this.file) return;
    const version = ++this.loadVersion; const text = await this.app.vault.read(this.file);
    if (version !== this.loadVersion) return;
    if (text !== this.doc.text && !initial) { this.history = new Timeline(); this.expanded.clear(); }
    this.doc = scan(text, this.file.basename); this.shell(); this.draw();
    await this.restoreLinks();
    if (initial) requestAnimationFrame(() => { if (version === this.loadVersion) this.fit(); });
  }
  private async restoreLinks() {
    for (const key of [...this.preferences.openLinks]) {
      const display=this.displays.get(key);if(display&&!this.expanded.has(key))await this.expandLink(display,false);
    }
  }
  private remember() { if (this.file) { this.preferences.selection = this.selected; this.plugin.preferences[this.file.path] = this.preferences; void this.plugin.persist().catch(e => new Notice(`無法儲存顯示設定：${e}`)); } }
  private shell() {
    if (this.bodyEditor) return;
    this.titleEditor?.remove(); this.titleEditor = null;
    const host = this.contentEl; host.empty(); host.addClass('mwi'); host.dataset.theme = this.preferences.theme;
    const toolbar = host.createDiv('mwi-toolbar');
    let group = toolbar.createDiv('mwi-control-group');
    const button = (icon: string, label: string, action: () => void) => {
      const b = group.createEl('button', { attr: { 'aria-label': label, title: label, 'data-action': icon } }); setIcon(b, icon); b.onclick = action; return b;
    };
    const theme = group.createEl('select', { attr: { 'aria-label': '思維導圖主題' } });
    for (const [value, label] of Object.entries({ pastel: '柔光馬卡龍', linen: '無印暖木', mist: '清透藍白', night: '深夜靈感' })) theme.createEl('option', { value, text: label });
    theme.value = this.preferences.theme;
    theme.onchange = () => { this.preferences.theme = theme.value; host.dataset.theme = theme.value; this.remember(); this.draw(this.selected); };
    this.colorPickers = [];
    for (const [field, label, short] of [['color', '文字顏色', '字'], ['background', '節點底色', '底']] as const) {
      group.createSpan({ text: short });
      const picker = group.createEl('input', { type: 'color', attr: { 'aria-label': label, title: label } }); this.colorPickers.push(picker);
      picker.oninput = () => { this.preferences.colors[this.selected] = { ...this.preferences.colors[this.selected], [field]: picker.value }; this.remember(); this.draw(this.selected); };
    }
    button('rotate-ccw', '恢復所選節點的主題預設色', () => { delete this.preferences.colors[this.selected]; this.remember(); this.draw(this.selected); });
    group = toolbar.createDiv('mwi-control-group');
    button('undo-2', '復原（Ctrl/Cmd + Z）', () => { void this.travel(false); }).disabled = !this.history.undo.length;
    button('redo-2', '重做（Ctrl/Cmd + Shift + Z）', () => { void this.travel(true); }).disabled = !this.history.redo.length;
    group = toolbar.createDiv('mwi-control-group');
    button('minus', '縮小導圖', () => this.zoom(Math.max(.02, this.camera.scale - .1) / this.camera.scale));
    this.zoomLabel = group.createSpan('mwi-zoom-label');
    button('plus', '放大導圖', () => this.zoom((this.camera.scale + .1) / this.camera.scale));
    button('scan', '適配全圖', () => this.fit());
    button('house', '回到原點', () => { this.camera = new Camera(); this.transform(); });
    group = toolbar.createDiv('mwi-control-group');
    button('list-plus', '全部展開', () => { this.preferences.folded = []; this.remember(); this.draw(this.selected); });
    button('list-minus', '全部收合', () => { this.preferences.folded = [...this.displays.keys()]; this.selected = 'root'; this.remember(); this.draw('root'); });
    for (const [field, label] of [['lists', '清單項目'], ['excerpt', '顯示內文']] as const) {
      const wrap = toolbar.createEl('label'); const input = wrap.createEl('input', { type: 'checkbox' }); wrap.createSpan({text:label}); input.checked = this.preferences[field];
      input.onchange = () => { this.preferences[field] = input.checked; this.plugin.displaySettings[field]=input.checked; this.remember(); this.draw(this.selected); };
    }
    const wrapLabel = toolbar.createEl('label', {text:'每行'});
    const wrap = wrapLabel.createEl('input', { type: 'number', attr: { min: '6', step: '1', 'aria-label': '每行字數', title: '每行至少 6 字，無上限' } }); wrapLabel.createSpan({text:'字元'});
    wrap.value = String(this.preferences.wrap); wrap.onchange = () => { this.preferences.wrap = normalizeWrap(wrap.value); this.plugin.displaySettings.wrap=this.preferences.wrap; wrap.value = String(this.preferences.wrap); this.remember(); this.draw(this.selected); };
    group = toolbar.createDiv('mwi-control-group');
    button('file-plus', '新增 Markdown 檔案節點', () => new FilePicker(this.plugin, f => { void this.addNode(false, `[[${f.path.replace(/\.md$/, '')}|${f.basename}]]`, false); }).open());
    button('file-text', '切回 Markdown', () => { if (this.file) void this.closeBody().then(() => this.leaf.setViewState({ type: 'markdown', state: { file: this.file!.path }, active: true })); });
    button('keyboard', '快捷鍵', () => {
      const modal = new Modal(this.app); modal.titleEl.setText('MindWeave 快捷鍵');
      modal.modalEl.addClass('mwi-shortcut-modal');
      modal.contentEl.createEl('p',{text:'先選取節點，並讓焦點停留在心智圖畫布。文字編輯時使用編輯器本身的快捷鍵。'});
      const table = modal.contentEl.createEl('table',{cls:'mwi-shortcut-table'});
      const header = table.createEl('thead').createEl('tr');
      for(const text of ['功能','macOS（MacBook）','Windows']) header.createEl('th',{text,attr:{scope:'col'}});
      const body = table.createEl('tbody');
      for (const [action, mac, windows] of [
        ['編輯標題','R／雙擊','R／雙擊'],
        ['新增同級','Return（Enter）','Enter'],
        ['新增子節點','Tab','Tab'],
        ['複製子樹','Command（⌘）+ C','Ctrl + C'],
        ['剪下子樹','Command（⌘）+ X','Ctrl + X'],
        ['貼上為子節點','Command（⌘）+ V','Ctrl + V'],
        ['升級節點','Shift + Tab','Shift + Tab'],
        ['刪除節點與子樹','Delete（⌫）','Delete／Backspace'],
        ['展開／收合','空白鍵','空白鍵'],
        ['選取節點','方向鍵','方向鍵'],
        ['放大／縮小（以滑鼠位置為中心）','滑鼠中間滾輪','滑鼠中間滾輪'],
        ['同級排序','Option（⌥）+ ↑／↓','Alt + ↑／↓'],
        ['編輯正文','Command（⌘）+ Enter','Ctrl + Enter'],
        ['復原','Command（⌘）+ Z','Ctrl + Z'],
        ['重做','Command（⌘）+ Shift + Z','Ctrl + Shift + Z／Ctrl + Y'],
        ['顯示／收合正文','Command（⌘）+ Space','Ctrl + Space'],
      ]) { const row = body.createEl('tr'); for(const text of [action,mac,windows]) row.createEl('td',{text}); }
      modal.contentEl.createEl('p',{cls:'mwi-shortcut-note',text:'若 Command + Space 或 Ctrl + Space 被系統搜尋／輸入法攔截，可拖曳底部分隔線展開或收合正文。'});
      translateControls(modal.titleEl, this.plugin.language);
      translateControls(modal.contentEl, this.plugin.language);
      modal.open();
    });
    translateControls(toolbar, this.plugin.language);
    this.canvas = host.createDiv('mwi-canvas'); this.canvas.tabIndex = 0;
    this.world = this.canvas.createDiv('mwi-world');
    this.canvas.onwheel = e => { if ((e.target as Element).closest('.mwi-title-editor')) return; e.preventDefault(); e.stopPropagation(); const r = this.canvas.getBoundingClientRect(); this.camera.zoom(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.002), e.clientX - r.left, e.clientY - r.top); this.transform(); };
    this.canvas.onpointerdown = e => this.pointer(e);
    this.canvas.onkeydown = e => this.key(e);
    this.splitter = host.createDiv('mwi-splitter'); this.splitter.setAttribute('role', 'separator'); this.splitter.setAttribute('aria-label', '拖曳展開正文');
    this.splitter.onpointerdown = e => {
      e.preventDefault(); const start = e.clientY; const height = this.paneHeight; this.splitter.setPointerCapture(e.pointerId);
      this.splitter.onpointermove = v => { this.paneHeight = Math.max(0, Math.min(host.clientHeight - 160, height + start - v.clientY)); this.pane.style.height = `${this.paneHeight}px`; };
      const end = () => { this.splitter.onpointermove = null; this.splitter.onpointerup = null; this.splitter.onpointercancel = null; };
      this.splitter.onpointerup = end; this.splitter.onpointercancel = end;
    };
    this.pane = host.createDiv('mwi-pane'); this.pane.style.height = `${this.paneHeight}px`;
  }
  private row() { return this.displays.get(this.selected)?.source ?? this.doc.root; }
  private display(doc: Outline, row: Section, file: TFile, prefix = '', readonly = false): Display {
    const key = prefix + row.key;
    const result: Display = { key, title: linkOf(row.title)?.label ?? row.title, source: row, file, outline: doc, readonly,
      children: row.children.map(k => this.display(doc, doc.rows.get(k)!, file, prefix, readonly)) };
    result.children.push(...(this.expanded.get(key) ?? []).map(child => this.display(child.outline,child.source,child.file,child.key.slice(0,-child.source.key.length),true)));
    if (this.preferences.lists) {
      const body = doc.text.slice(row.body, row.bodyEnd);
      const virtual = (item: ListItem): Display => ({ key:`${key}:list:${item.index}`,title:item.title,source:row,file,outline:doc,readonly:true,children:item.children.map(virtual) });
      result.children.push(...listItems(body).map(virtual));
    }
    return result;
  }
  private layoutPending = false;
  onResize() {
    if (this.layoutPending && this.canvas?.clientWidth && this.canvas?.clientHeight) {
      this.draw(); void this.restoreLinks();
    }
  }
  private draw(anchor?: string) {
    if (!this.file) return;
    // Hidden tabs report zero node dimensions. Measure only once visible again.
    if (!this.canvas?.clientWidth || !this.canvas?.clientHeight) {
      this.layoutPending = true;
      return;
    }
    this.layoutPending = false;
    const old = anchor && this.boxes.get(anchor); const at = old ? this.camera.screen(old.x, old.y) : null;
    this.world.empty(); this.displays.clear(); this.boxes.clear();
    const root = this.display(this.doc, this.doc.root, this.file);
    const nodes = new Map<string, HTMLElement>();
    const build = (display: Display): Box => {
      this.displays.set(display.key, display);
      const el = this.world.createDiv('mwi-node'); el.dataset.key = display.key; el.dataset.depth = String(display.source.depth); nodes.set(display.key, el);
      if (display.key === this.selected) el.addClass('selected');
      Object.assign(el.style, this.preferences.colors[display.key] ?? {});
      const chars = Array.from(display.title); const lines: string[] = []; const wrap = this.preferences.wrap || Math.max(1, chars.length);
      for (let i = 0; i < chars.length; i += wrap) lines.push(chars.slice(i, i + wrap).join(''));
      const header = el.createDiv('mwi-node-header');
      header.createDiv({ cls: 'mwi-title', text: lines.join('\n') || '未命名' });
      header.createSpan({ cls: 'mwi-badge', text: display.key.includes(':list:') ? 'LI' : !display.source.depth ? 'DOC' : linkOf(display.source.title) ? 'MD' : `H${display.source.depth}` });
      if (this.preferences.excerpt) el.createDiv({ cls: 'mwi-excerpt', text: display.outline.text.slice(display.source.body, display.source.bodyEnd).trim().slice(0, 180) });
      el.onclick = () => { if (!this.suppressClick) void this.select(display.key, true); };
      el.ondblclick = () => { void this.select(display.key).then(() => { if (linkOf(display.source.title)) void this.expandLink(display); else this.editTitle(); }); };
      const folded = this.preferences.folded.includes(display.key);
      if (display.children.length) {
        const fold = el.createEl('button', { text: folded ? '+' : '−', cls: 'mwi-fold', attr: { 'aria-label': '展開或收合節點' } });
        fold.onpointerdown = e => e.stopPropagation(); fold.onclick = e => { e.stopPropagation(); if (!display.children.length && linkOf(display.source.title)) void this.expandLink(display); else this.fold(display.key); };
      }
      const box: Box = { key: display.key, width: el.offsetWidth, height: el.offsetHeight, x: 0, y: 0, children: folded ? [] : display.children.map(build) };
      this.boxes.set(display.key, box); return box;
    };
    const box = build(root); this.size = arrange(box);
    const svg = this.contentEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('mwi-edges'); this.world.prepend(svg);
    for (const b of this.boxes.values()) {
      const el = nodes.get(b.key)!; el.style.left = `${b.x}px`; el.style.top = `${b.y}px`;
      for (const child of b.children) {
        const path = this.contentEl.ownerDocument.createElementNS(svg.namespaceURI, 'path'); const x = b.x + b.width; const y = b.y + b.height / 2; const cy = child.y + child.height / 2;
        path.setAttribute('d', `M ${x} ${y} C ${x + 36} ${y}, ${child.x - 36} ${cy}, ${child.x} ${cy}`); svg.append(path);
      }
    }
    const next = anchor && this.boxes.get(anchor);
    if (at && next) { this.camera.x = at.x - next.x * this.camera.scale; this.camera.y = at.y - next.y * this.camera.scale; }
    if (!this.displays.has(this.selected)) this.selected = 'root';
    const undo=this.contentEl.querySelector<HTMLButtonElement>('button[data-action="undo-2"]');if(undo)undo.disabled=!this.history.undo.length;
    const redo=this.contentEl.querySelector<HTMLButtonElement>('button[data-action="redo-2"]');if(redo)redo.disabled=!this.history.redo.length;
    this.syncColors(); this.transform(); void this.showBody();
  }
  private syncColors() {
    const node = Array.from(this.world.querySelectorAll<HTMLElement>('.mwi-node')).find(e => e.dataset.key === this.selected);
    if (!node) return;
    const css = getComputedStyle(node);
    [css.color, css.backgroundColor].forEach((color, index) => {
      const parts = color.match(/\d+/g);
      if (parts && this.colorPickers[index]) this.colorPickers[index].value = '#' + parts.slice(0,3).map(v => Number(v).toString(16).padStart(2,'0')).join('');
    });
  }
  private async select(key: string, revealBody = false) {
    if (key !== this.selected) await this.closeBody();
    this.selected = key; this.remember();
    if (revealBody && this.paneHeight === 0) {
      this.paneHeight = Math.min(280, Math.max(120, this.contentEl.clientHeight * .4));
      this.pane.style.height = `${this.paneHeight}px`;
    }
    this.world.querySelectorAll<HTMLElement>('.mwi-node').forEach(n => n.toggleClass('selected', n.dataset.key === key));
    this.syncColors(); void this.showBody(); this.canvas.focus({preventScroll:true});
  }
  private fold(key: string) {
    const list = this.preferences.folded; this.preferences.folded = list.includes(key) ? list.filter(k => k !== key) : [...list, key];
    this.remember(); this.draw(key);
  }
  private transform() { this.world.style.transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.scale})`; this.zoomLabel.setText(`${Math.round(this.camera.scale * 100)}%`); }
  private fit() { this.camera.fit(this.size.width, this.size.height, this.canvas.clientWidth, this.canvas.clientHeight); this.transform(); }
  private zoom(factor: number) { this.camera.zoom(factor, this.canvas.clientWidth / 2, this.canvas.clientHeight / 2); this.transform(); }
  private pointer(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button,input,textarea,.mwi-title-editor')) return;
    const node = (e.target as Element).closest<HTMLElement>('.mwi-node'); const key = node?.dataset.key;
    if (!node && this.titleEditor?.isConnected) {
      e.preventDefault(); e.stopPropagation();
      this.titleEditor.dispatchEvent(new Event('mindweave-submit-title'));
      return;
    }
    const source = key ? this.displays.get(key) : null;
    const pan = !source || source.key === 'root';
    if (!pan && source?.readonly) return;
    e.preventDefault();
    const initial = { x: e.clientX, y: e.clientY, tx: this.camera.x, ty: this.camera.y }; let dragged = false;
    let drop: { row: Section; relation: 'before' | 'after' | 'child' } | null = null;
    let preview: HTMLElement | null = null;
    let hint: HTMLElement | null = null;
    const clear = () => this.world.querySelectorAll('[data-drop]').forEach(n => n.removeAttribute('data-drop'));
    this.canvas.onpointermove = p => {
      const dx = p.clientX - initial.x; const dy = p.clientY - initial.y;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      // Capture only after a drag begins; capturing on pointerdown retargets a
      // normal click to the canvas instead of the node that was pressed.
      if (!dragged) {
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.addClass('mwi-dragging');
        if (!pan && source) {
          node?.addClass('mwi-drag-source');
          preview = this.canvas.createDiv('mwi-drag-preview');
          preview.createDiv({text:source.title,cls:'mwi-drag-title'});
          hint = preview.createDiv('mwi-drag-hint');
        }
      }
      dragged = true; this.suppressClick = true;
      if (pan) { this.camera.x = initial.tx + dx; this.camera.y = initial.ty + dy; this.transform(); }
      else {
        const canvasRect = this.canvas.getBoundingClientRect();
        if(preview){preview.style.left=`${p.clientX-canvasRect.left+14}px`;preview.style.top=`${p.clientY-canvasRect.top+14}px`;}
        hint?.setText('拖到節點中央：移入子節點；上／下緣：排序');
        clear(); drop = null;
        const target = this.canvas.ownerDocument.elementFromPoint(p.clientX, p.clientY)?.closest<HTMLElement>('.mwi-node');
        const d = target?.dataset.key ? this.displays.get(target.dataset.key) : null;
        if (target && d && !d.readonly && d.key !== key && !(d.source.depth>0 && d.source.start>=source!.source.start && d.source.start<source!.source.end)) {
          const rect = target.getBoundingClientRect(); const ratio = (p.clientY - rect.top) / rect.height;
          const relation = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'child';
          if(d.source.depth || relation==='child'){
            target.dataset.drop = relation; drop = { row: d.source, relation };
            hint?.setText(relation==='child'?`放開：移入「${d.title}」底下`:relation==='before'?`放開：移到「${d.title}」之前`:`放開：移到「${d.title}」之後`);
          }
        }
      }
    };
    const finish = (cancel: boolean) => {
      this.canvas.onpointermove = null; this.canvas.onpointerup = null; this.canvas.onpointercancel = null;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      preview?.remove();node?.removeClass('mwi-drag-source');this.canvas.removeClass('mwi-dragging');
      clear(); if (!cancel && dragged && source && drop) { const target = drop; this.selected = source.key; void this.moveNode(source.source, target.row, target.relation); }
      setTimeout(() => { this.suppressClick = false; }, 0);
    };
    this.canvas.onpointerup = () => finish(false); this.canvas.onpointercancel = () => finish(true);
  }
  private async target(display: Display): Promise<{ file: TFile; doc: Outline; row: Section; text: string; from: number; to: number }> {
    const link = linkOf(display.source.title);
    if (!link) {
      const doc = scan(await this.app.vault.read(display.file),display.file.basename);
      const row = doc.rows.get(display.source.key);
      if (!row) throw new Error('來源章節已變更，請重新選取節點。');
      return { file: display.file, doc, row, text: doc.text.slice(row.body,row.bodyEnd), from:row.body, to:row.bodyEnd };
    }
    const file = link.path ? this.app.metadataCache.getFirstLinkpathDest(link.path, display.file.path) : display.file;
    if (!file || file.extension !== 'md') throw new Error('找不到連結的 Markdown 筆記。');
    const text = await this.app.vault.cachedRead(file); const doc = scan(text, file.basename);
    if (!link.fragment) return { file, doc, row: doc.root, text, from:doc.root.body, to:text.length };
    if (link.fragment.startsWith('^')) {
      const block = this.app.metadataCache.getFileCache(file)?.blocks?.[link.fragment.slice(1)];
      if (!block) throw new Error('找不到連結區塊。');
      return { file, doc, row: doc.root, text: text.slice(block.position.start.offset, block.position.end.offset), from:block.position.start.offset, to:block.position.end.offset };
    }
    const row = [...doc.rows.values()].find(r => r.title === link.fragment);
    if (!row) throw new Error('找不到連結章節。');
    return { file, doc, row, text: text.slice(row.body, row.end), from:row.body, to:row.end };
  }
  private async expandLink(display: Display, save = true) {
    if (this.expanded.has(display.key)) { this.expanded.delete(display.key); this.preferences.openLinks = [...this.expanded.keys()]; this.remember(); this.draw(display.key); return; }
    try {
      const target = await this.target(display);
      this.expanded.set(display.key, target.row.children.map(k => this.display(target.doc, target.doc.rows.get(k)!, target.file, display.key + ':external:', true)));
      if (save) { this.preferences.openLinks = [...this.expanded.keys()]; this.remember(); }
      this.preferences.folded = this.preferences.folded.filter(k => k !== display.key); this.draw(display.key);
    } catch (e) { new Notice(String(e)); }
  }
  private async showBody() {
    if (this.bodyEditor) return;
    const generation = ++this.previewVersion; const d = this.displays.get(this.selected) ?? this.displays.get('root'); if (!d) return;
    try {
      const target = await this.target(d); if (generation !== this.previewVersion) return;
      this.removeChild(this.preview); this.preview = new Component(); this.addChild(this.preview);
      this.pane.empty(); const heading = this.pane.createDiv('mwi-pane-heading'); heading.createSpan({ text: '正文', cls:'mwi-pane-label' }); heading.createSpan({ text: d.title, cls:'mwi-pane-title' });
      const edit = heading.createEl('button', { attr:{'aria-label':'編輯目前正文'} }); setIcon(edit, 'pencil');
      edit.onclick = () => { void this.editBody().catch(e=>new Notice(String(e))); };
      await MarkdownRenderer.render(this.app, target.text || '暫無正文', this.pane.createDiv('mwi-prose'), target.file.path, this.preview);
    } catch (e) { if (generation === this.previewVersion) this.pane.setText(String(e)); }
  }
  private editable() {
    if (this.displays.get(this.selected)?.readonly) { new Notice('外部大綱與清單節點為唯讀。'); return false; } return true;
  }
  private editTitle() {
    if (!this.editable() || !this.row().depth) return;
    const row = this.row(); const snapshot = this.doc.text;
    const identities = [...this.doc.rows.values()];
    this.titleEditor?.remove();
    const overlay = this.canvas.createDiv('mwi-title-editor'); this.titleEditor = overlay;
    const node = this.boxes.get(this.selected)!; const at = this.camera.screen(node.x,node.y);
    overlay.style.left = `${Math.max(8,Math.min(this.canvas.clientWidth - 368,at.x))}px`;
    overlay.style.top = `${Math.max(8,Math.min(this.canvas.clientHeight - 156,at.y))}px`;
    const input = overlay.createEl('textarea',{cls:'mwi-editor',attr:{'aria-label':'編輯節點標題'}}); input.value = linkOf(row.title)?.label ?? row.title;
    overlay.createDiv({text:'Enter 或點擊畫布空白處儲存 · Esc 取消',cls:'mwi-editor-hint'});
    const cancel = () => { overlay.remove(); this.titleEditor = null; this.canvas.focus({preventScroll:true}); };
    let submitting = false;
    const submit = async () => {
      if (this.busy || submitting) return;
      submitting = true;
      try { await this.edit(d => renameLabel(d,row,input.value),true,snapshot, next => {
        this.transferIdentities(identities,[...next.rows.values()]);
      }); cancel(); } catch (error) { new Notice(String(error)); }
      finally { submitting = false; }
    };
    overlay.addEventListener('mindweave-submit-title', () => { void submit(); });
    overlay.onpointerdown = e => e.stopPropagation();
    input.onkeydown = e => { e.stopPropagation(); if(e.isComposing)return; if(e.key==='Escape'){e.preventDefault();cancel();} else if(e.key==='Enter'){e.preventDefault();void submit();} };
    input.focus({preventScroll:true}); input.select();
  }
  private async editBody() {
    if (!this.file || this.bodyEditor) return;
    const display = this.displays.get(this.selected); if(!display)return;
    if(display.key.includes(':list:')) {new Notice('清單節點為唯讀，請選取其所屬標題編輯正文。');return;}
    const selected = this.selected;
    const target = await this.target(display);
    if (this.selected !== selected || this.bodyEditor) return;
    this.paneHeight = Math.max(280, this.paneHeight); this.pane.style.height = `${this.paneHeight}px`; this.previewVersion++;
    this.pane.empty(); const heading = this.pane.createDiv('mwi-pane-heading'); heading.createSpan({text:`正文　${display.title}`,cls:'mwi-pane-title',attr:{title:target.file.path}});
    const done = heading.createEl('button',{text:'完成',cls:'mod-cta'}); done.onclick = () => { void this.closeBody().then(()=>this.showBody()).catch(e=>new Notice(String(e))); };
    const editor = this.nativeEditor ?? new SectionEditor(this.leaf, (text,file) => {
      const updated = scan(text,file.basename);
      if(file===this.file){this.history = new Timeline(); this.uiHistory.clear(); this.doc = updated;}
      for(const [key,children] of this.expanded) this.expanded.set(key,children.flatMap(child=>{
        if(child.file!==file)return [child];
        const source=updated.rows.get(child.source.key);
        return source?[{...child,source,outline:updated}]:[];
      }));
      this.draw(this.selected);
    });
    if(!this.nativeEditor) { this.nativeEditor=editor;this.addChild(editor); }
    this.bodyEditor = editor; this.pane.append(editor.containerEl); editor.containerEl.addClass('mwi-native-editor');
    try { await editor.start(target.file,target.doc.text,target.from,target.to); }
    catch(e) { this.bodyEditor = null; this.nativeEditor = null; this.removeChild(editor); editor.containerEl.remove(); new Notice(String(e)); }
  }
  private async closeBody() {
    const editor = this.bodyEditor; if (!editor) return;
    await editor.save(); this.bodyEditor = null; editor.containerEl.remove();
  }
  private transferIdentities(before: Section[], after: Section[]) {
    const mapping = new Map(before.map((row,index) => [row.key,after[index]?.key ?? row.key]));
    const translate = (key: string) => {
      if(mapping.has(key)) return mapping.get(key)!;
      for(const [from,to] of mapping) if(key.startsWith(from+':')) return to+key.slice(from.length);
      return key;
    };
    this.preferences.colors = Object.fromEntries(Object.entries(this.preferences.colors).map(([k,v]) => [translate(k),v]));
    this.preferences.folded = this.preferences.folded.map(translate);
    this.preferences.openLinks = this.preferences.openLinks.map(translate);
    this.expanded = new Map([...this.expanded].map(([k,v]) => [translate(k),v]));
    this.selected = translate(this.selected);
  }
  private async copyBranch(cut: boolean) {
    if (!this.file || this.busy || !this.editable()) return;
    const row = this.row();
    if (!row.depth) { new Notice('請選取標題節點，不是文件根節點。'); return; }
    const clip = {chunk:this.doc.text.slice(row.start,row.end),path:this.file.path,key:row.key,original:this.doc.text,cut};
    await this.containerEl.ownerDocument.defaultView!.navigator.clipboard.writeText(clip.chunk);
    this.plugin.branchClipboard = clip;
  }
  private async pasteClipboard() {
    if (!this.file || this.busy || !this.editable()) return;
    const selected = this.selected; const file = this.file;
    const text = await this.containerEl.ownerDocument.defaultView!.navigator.clipboard.readText();
    if (this.file !== file || this.selected !== selected || this.busy) return;
    const clip = this.plugin.branchClipboard?.chunk === text ? this.plugin.branchClipboard : undefined;
    const target = this.row();
    if (clip?.cut) {
      if (clip.path !== this.file.path) { new Notice('剪下貼上目前限同一份筆記；跨筆記請使用複製。'); return; }
      if (clip.original !== this.doc.text) { new Notice('來源筆記已變更，請重新剪下節點。'); return; }
      const row = this.doc.rows.get(clip.key);
      if (!row) return;
      const before = this.doc.text;
      await this.moveNode(row,target,'child');
      if (this.doc.text !== before) this.plugin.branchClipboard = undefined;
      return;
    }
    const identities = [...this.doc.rows.values()];
    const count = clip ? [...scan(clip.chunk).rows.values()].filter(r=>r.depth).length : textTitles(text).length;
    if (!count) return;
    const at = identities.findIndex(r=>r.depth && r.start>=target.end);
    const index = at<0 ? identities.length : at;
    await this.edit(doc=>clip ? pasteBranch(doc,target,clip.chunk) : pasteText(doc,target,text),false,undefined,next=>{
      const rows=[...next.rows.values()];
      this.transferIdentities(identities,rows.filter((_,i)=>i<index||i>=index+count));
      this.preferences.folded=this.preferences.folded.filter(k=>k!==target.key);
    },target.key);
  }
  private async addNode(sibling: boolean, title = '新節點', editTitle = true) {
    const row = this.row(); const at = row.end;
    const identities = [...this.doc.rows.values()];
    await this.edit(doc => add(doc,row,sibling,title),false,undefined,next => {
      const added = [...next.rows.values()].find(r => r.title === title && r.start >= at);
      if (added) { this.transferIdentities(identities,[...next.rows.values()].filter(r=>r!==added)); this.selected = added.key; if (added.parent) this.preferences.folded = this.preferences.folded.filter(k => k !== added.parent); }
    },row.key);
    if (editTitle && this.row().title === title) this.editTitle();
  }
  private async moveNode(row: Section, target: Section, relation: 'before'|'after'|'child') {
    const parent = relation === 'child' ? target.key : target.parent;
    const anchorKey = { before: target.key, after: target.key };
    const identities = [...this.doc.rows.values()];
    const branch = identities.filter(r=>r.depth>0 && r.start>=row.start && r.start<row.end);
    const rest = identities.filter(r=>!branch.includes(r));
    const insert = relation==='before' ? rest.indexOf(target) : rest.findIndex(r=>r.depth>0 && r.start>=target.end);
    rest.splice(insert<0?rest.length:insert,0,...branch);
    await this.edit(doc => move(doc,row,target,relation),false,undefined,next => {
      const nextRows = [...next.rows.values()];
      this.transferIdentities(rest,nextRows);
      // Keep the destination stationary, including when duplicate titles change keys.
      anchorKey.after = nextRows[rest.indexOf(target)].key;
      const nextParent = nextRows[rest.findIndex(r=>r.key===parent)]?.key;
      if(nextParent) this.preferences.folded = this.preferences.folded.filter(k=>k!==nextParent);
    },anchorKey);
  }
  private async deleteNode(row: Section) {
    const removed=[...this.doc.rows.values()].filter(r=>r.depth>0&&r.start>=row.start&&r.start<row.end);
    const survivors=[...this.doc.rows.values()].filter(r=>!removed.includes(r));
    await this.edit(doc=>splice(doc,row.start,row.end,''),false,undefined,next=>{
      const keep=(key:string)=>!removed.some(r=>key===r.key||key.startsWith(r.key+':'));
      this.preferences.colors=Object.fromEntries(Object.entries(this.preferences.colors).filter(([k])=>keep(k)));
      this.preferences.folded=this.preferences.folded.filter(keep);this.preferences.openLinks=this.preferences.openLinks.filter(keep);
      this.expanded=new Map([...this.expanded].filter(([k])=>keep(k)));
      this.selected=row.parent??'root';this.transferIdentities(survivors,[...next.rows.values()]);
    },row.parent??'root');
  }
  private async edit(change: (d: Outline) => string, rethrow = false, expected?: string, reconcile?: (next: Outline) => void, anchorKey?: string | { before: string; after: string }) {
    if (!this.file || this.busy || (expected === undefined && !this.editable())) return;
    await this.closeBody();
    this.busy = true; const before = this.doc.text;
    const selectedBox = this.boxes.get(typeof anchorKey==='object'?anchorKey.before:anchorKey??this.selected); const anchor = selectedBox ? this.camera.screen(selectedBox.x,selectedBox.y) : null;
    try {
      if (expected !== undefined && expected !== before) throw new Error('編輯期間筆記已變更，請先重新開啟編輯器。');
      const after = change(this.doc); if (after === before) return;
      await this.app.vault.process(this.file, current => { if (current !== before) throw new Error('筆記已在其他地方修改，請重新開啟後再編輯。'); return after; });
      this.uiHistory.set(before,structuredClone({...this.preferences,selection:this.selected}));
      this.history.record(before); this.doc = scan(after, this.file.basename); reconcile?.(this.doc);
      if (!this.doc.rows.has(this.selected)) this.selected = 'root';
      this.uiHistory.set(after,structuredClone({...this.preferences,selection:this.selected}));
      this.expanded.clear(); this.remember(); this.shell(); this.draw(); await this.restoreLinks();
      const selectedBoxAfter = this.boxes.get(typeof anchorKey==='object'?anchorKey.after:anchorKey??this.selected);
      if(anchor&&selectedBoxAfter){this.camera.x=anchor.x-selectedBoxAfter.x*this.camera.scale;this.camera.y=anchor.y-selectedBoxAfter.y*this.camera.scale;this.transform();}
    } catch (e) { if (rethrow) throw e; new Notice(String(e)); }
    finally { this.busy = false; }
  }
  private async travel(forward: boolean) {
    if (!this.file || this.busy) return;
    await this.closeBody();
    const before = this.doc.text; const undo = [...this.history.undo]; const redo = [...this.history.redo];
    const next = this.history.travel(before, forward); if (next === undefined) return;
    this.busy = true;
    try {
      await this.app.vault.process(this.file, current => { if (current !== before) throw new Error('檔案已變更，無法安全復原。'); return next; });
      this.uiHistory.set(before,structuredClone({...this.preferences,selection:this.selected}));
      const restored = scan(next, this.file.basename);
      let anchorRow = this.doc.rows.get(this.selected) ?? this.doc.root;
      while (!restored.rows.has(anchorRow.key) && anchorRow.parent) anchorRow = this.doc.rows.get(anchorRow.parent)!;
      const box = this.boxes.get(anchorRow.key); const anchor = box ? this.camera.screen(box.x,box.y) : null;
      this.doc = restored;
      const state = this.uiHistory.get(next); if (state) this.preferences = structuredClone(state);
      this.selected = this.preferences.selection; this.expanded.clear(); this.remember(); this.shell(); this.draw(); await this.restoreLinks();
      const after = this.boxes.get(anchorRow.key);
      if(anchor&&after){this.camera.x=anchor.x-after.x*this.camera.scale;this.camera.y=anchor.y-after.y*this.camera.scale;this.transform();}
    } catch (e) { this.history.undo = undo; this.history.redo = redo; new Notice(String(e)); }
    finally { this.busy = false; }
  }
  private key(e: KeyboardEvent) {
    if ((e.target as Element).closest('input,textarea,[contenteditable="true"]') || e.isComposing) return;
    const cmd = e.metaKey || e.ctrlKey; const row = this.row(); const d = this.displays.get(this.selected);
    let action: (() => void) | undefined;
    if (cmd && e.key.toLowerCase() === 'c') action = () => { void this.copyBranch(false).catch(error=>new Notice(String(error))); };
    else if (cmd && e.key.toLowerCase() === 'x') action = () => { void this.copyBranch(true).catch(error=>new Notice(String(error))); };
    else if (cmd && e.key.toLowerCase() === 'v') action = () => { void this.pasteClipboard().catch(error=>new Notice(String(error))); };
    else if (cmd && e.key.toLowerCase() === 'z') action = () => { void this.travel(e.shiftKey); };
    else if (cmd && e.key.toLowerCase() === 'y') action = () => { void this.travel(true); };
    else if (cmd && e.key === 'Enter') action = () => { void this.editBody().catch(error=>new Notice(String(error))); };
    else if (cmd && e.code === 'Space') action = () => { this.paneHeight = this.paneHeight ? 0 : 280; this.pane.style.height = `${this.paneHeight}px`; };
    else if (e.key.toLowerCase() === 'r' && !cmd) action = () => this.editTitle();
    else if (e.key === ' ') action = () => this.fold(this.selected);
    else if (e.key === 'Enter') action = () => { void this.addNode(true); };
    else if (e.key === 'Tab') action = () => {
      if (e.shiftKey) { const parent = row.parent ? this.doc.rows.get(row.parent) : undefined; if (parent?.depth) void this.moveNode(row,parent,'after'); }
      else void this.addNode(false);
    };
    else if (e.key === 'Delete' || e.key === 'Backspace') action = () => { if (row.depth && this.editable()) void this.deleteNode(row); };
    else if (e.key.startsWith('Arrow') && d) action = () => {
      const parent = [...this.displays.values()].find(v => v.children.some(c => c.key === d.key));
      const siblings = parent?.children ?? []; const index = siblings.findIndex(v => v.key === d.key);
      const next = e.key === 'ArrowLeft' ? parent : e.key === 'ArrowRight' ? (this.preferences.folded.includes(d.key) ? undefined : d.children[0]) : siblings[index + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next && e.altKey && !next.readonly && !d.readonly && ['ArrowUp','ArrowDown'].includes(e.key)) void this.moveNode(row,next.source,e.key === 'ArrowUp' ? 'before' : 'after');
      else if (next) void this.select(next.key, true);
    };
    if (action) { e.preventDefault(); e.stopPropagation(); action(); }
  }
}
