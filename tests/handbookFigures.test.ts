import { describe, expect, it } from 'vitest';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { HANDBOOK_FIGURES } from '../src/content/handbookFigures';

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
      for (const g of f.groups ?? []) expect(g.x >= 0 && g.y >= 0 && g.x + g.w <= f.width && g.y + g.h <= f.height, `${g.label} がはみ出す`).toBe(true);
    });
  }
});
