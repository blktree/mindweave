import { MarkdownView, editorInfoField, type TFile, type WorkspaceLeaf } from 'obsidian';
import { EditorState, StateField, EditorSelection } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

// The native editor holds the WHOLE document. Only this section is visible/editable.
// Native clipboard handling, suggestions and installed editor extensions remain active.
export class SectionEditor extends MarkdownView {
  from = 0;
  to = 0;
  ready = false;
  snapshot = '';
  failure = '';
  private queue: Promise<void> = Promise.resolve();
  constructor(leaf: WorkspaceLeaf, private changed: (text: string, file: TFile) => void) { super(leaf); }
  async start(file: TFile, text: string, from: number, to: number) {
    const same = this.file === file && this.getViewData() === text;
    this.ready = false;
    this.from = from; this.to = to; this.snapshot = text;
    if (!same) {
      await this.setState({ file: file.path, mode: 'source', source: true }, { history: false });
      this.setViewData(text, true);
    }
    this.ready = true;
    this.editor.setCursor(this.editor.offsetToPos(from));
    this.editor.focus();
  }
  async save(clear?: boolean) {
    if (!this.ready || !this.file) return;
    this.queue = this.queue.catch(() => {}).then(async () => {
      const file = this.file;
      if (!file) return;
      const text = this.getViewData();
      try {
        // Keep native dirty/saved-data tracking and external-change handling intact.
        await super.save(clear);
        const changed = text !== this.snapshot;
        this.snapshot = text; this.failure = '';
        if (changed && !clear) this.changed(text, file);
      } catch (error) { this.failure = String(error); throw error; }
    });
    return this.queue;
  }
}

function section(state: EditorState) {
  const info = state.field(editorInfoField, false);
  return info instanceof SectionEditor && info.ready ? info : null;
}

export const sectionProjection = [
  EditorState.transactionFilter.of(tr => {
    const owner = section(tr.startState);
    if (!owner) return tr;
    let outside = false;
    tr.changes.iterChangedRanges((from, to) => { if (from < owner.from || to > owner.to) outside = true; });
    if (outside) return [];
    const end = tr.changes.mapPos(owner.to, 1);
    if (tr.docChanged && owner.to < tr.startState.doc.length && end > owner.from && tr.newDoc.sliceString(end-1,end) !== '\n') {
      return [tr,{changes:{from:end,insert:'\n'},sequential:true}];
    }
    const selection = tr.newSelection.main;
    const clamp = (n: number) => Math.max(owner.from, Math.min(end, n));
    if (selection.from < owner.from || selection.to > end) return [tr, { selection: EditorSelection.single(clamp(selection.anchor), clamp(selection.head)), sequential: true }];
    return tr;
  }),
  StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(_value, tr) {
      const owner = section(tr.startState) ?? section(tr.state);
      if (!owner) return Decoration.none;
      owner.to = tr.changes.mapPos(owner.to, 1);
      const ranges = [];
      if (owner.from) ranges.push(Decoration.replace({ block: true }).range(0, owner.from));
      if (owner.to < tr.newDoc.length) ranges.push(Decoration.replace({ block: true }).range(owner.to, tr.newDoc.length));
      return Decoration.set(ranges);
    },
    provide: field => EditorView.decorations.from(field),
  }),
];
