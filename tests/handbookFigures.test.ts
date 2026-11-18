import { describe, expect, it } from 'vitest';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { HANDBOOK_FIGURES } from '../src/content/handbookFigures';
import { edgeEnds, labelPlace, type DiagramNode } from '../src/components/Diagram';

type Pt = { x: number; y: number };
/** 線分が箱 (少し内側に縮めた形) を通るか */
function segmentHitsBox(p: Pt, q: Pt, n: DiagramNode, inset = 0.5): boolean {
  const x0 = n.x + inset, x1 = n.x + n.w - inset, y0 = n.y + inset, y1 = n.y + n.h - inset;
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000;
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
    if (x > x0 && x < x1 && y > y0 && y < y1) return true;
  }
  return false;
}
/** 矢印の文字の幅の見積もり (全角 11px・半角 6.5px) */
const textWidth = (t: string) => [...t].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? 11 : 6.5), 0);

describe('ハンドブックの図', () => {
  it('どのトピックにも図があり、知らないトピックの図は無い', () => {
    const ids = HANDBOOK_TOPICS.map((t) => t.id).sort();
    expect(Object.keys(HANDBOOK_FIGURES).sort()).toEqual(ids);
  });
  for (const [id, f] of Object.entries(HANDBOOK_FIGURES)) {
    it(`${id}: 矢印は実在する箱を結び、箱は図の中に収まって重ならない`, () => {
      expect(f.caption.length).toBeGreaterThan(20);
      const nodes = new Map(f.nodes.map((n) => [n.id, n]));
      expect(nodes.size).toBe(f.nodes.length);
      for (const e of f.edges) {
        expect(nodes.has(e.from), `${e.from}`).toBe(true);
        expect(nodes.has(e.to), `${e.to}`).toBe(true);
      }
      for (const n of f.nodes) {
        expect(n.x >= 0 && n.y >= 0 && n.x + n.w <= f.width && n.y + n.h <= f.height, `${n.id} がはみ出す`).toBe(true);
      }
      for (const a of f.nodes)
        for (const b of f.nodes) {
          if (a === b) continue;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.id} と ${b.id} が重なる`).toBe(false);
        }
      for (const e of f.edges) {
        const { p, q } = edgeEnds(f, e);
        for (const n of f.nodes) {
          if (n.id === e.from || n.id === e.to) continue;
          expect(segmentHitsBox(p, q, n), `${e.from}→${e.to} の線が ${n.id} を通る`).toBe(false);
        }
        if (e.label) {
          const at = labelPlace(p, q);
          const w = textWidth(e.label);
          const x0 = at.anchor === 'middle' ? at.x - w / 2 : at.x;
          const box = { x: x0, y: at.y - 10, w, h: 12 };
          for (const n of f.nodes) {
            const hit = box.x < n.x + n.w && n.x < box.x + box.w && box.y < n.y + n.h && n.y < box.y + box.h;
            expect(hit, `矢印の文字「${e.label}」が ${n.id} に重なる`).toBe(false);
          }
        }
      }
      for (const g of f.groups ?? []) expect(g.x >= 0 && g.y >= 0 && g.x + g.w <= f.width && g.y + g.h <= f.height, `${g.label} がはみ出す`).toBe(true);
    });
  }
});
