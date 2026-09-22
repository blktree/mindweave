export class Camera {
  x = 24; y = 24; scale = 1;
  screen(x: number, y: number) { return { x: this.x + x * this.scale, y: this.y + y * this.scale }; }
  zoom(factor: number, px: number, py: number) {
    const next = Math.max(0.02, Math.min(4, this.scale * factor));
    const ratio = next / this.scale;
    this.x = px - (px - this.x) * ratio;
    this.y = py - (py - this.y) * ratio;
    this.scale = next;
  }
  fit(w: number, h: number, width: number, height: number) {
    this.scale = Math.min(1, Math.max(0.02, Math.min((width - 48) / w, (height - 48) / h)));
    this.x = 24; this.y = Math.max(24, (height - h * this.scale) / 2);
  }
}
export interface Box { key: string; width: number; height: number; children: Box[]; x: number; y: number }
export function arrange(root: Box): { width: number; height: number } {
  const spans = new Map<Box, number>();
  function measure(b: Box): number {
    const children = b.children.map(measure);
    const span = Math.max(b.height, children.reduce((a, v) => a + v, 0) + Math.max(0, children.length - 1) * 40);
    spans.set(b, span); return span;
  }
  let width = 0;
  function place(b: Box, x: number, top: number) {
    b.x = x; b.y = top + (spans.get(b)! - b.height) / 2;
    width = Math.max(width, x + b.width);
    let cursor = top;
    for (const child of b.children) { place(child, x + b.width + 120, cursor); cursor += spans.get(child)! + 40; }
  }
  const height = measure(root); place(root, 0, 0); return { width, height };
}
