import { describe, expect, it } from 'vitest';
import glossary from '../src/content/glossary.json';
import { GLOSSARY_FIGURES, figureOf } from '../src/content/glossaryFigures';
import { expectGoodLayout } from './diagramLayout';

const TERMS = new Set((glossary as { terms: { id: string }[] }).terms.map((t) => t.id));

describe('用語集の図', () => {
  it('図の id は重ならず、用語は用語集にあり、1 つの用語は 1 つの図だけ', () => {
    const ids = GLOSSARY_FIGURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const terms = GLOSSARY_FIGURES.flatMap((f) => f.terms);
    expect(new Set(terms).size).toBe(terms.length);
    for (const t of terms) expect(TERMS.has(t), t).toBe(true);
  });
  it('ほとんどの用語に図がある (図の無い用語は 1 割まで)', () => {
    const without = [...TERMS].filter((t) => !figureOf(t));
    expect(without.length, without.join(', ')).toBeLessThanOrEqual(Math.floor(TERMS.size / 10));
  });
  for (const f of GLOSSARY_FIGURES) {
    it(`${f.id}: 用語ごとに強調する箱があり、配置が崩れない`, () => {
      expect(f.spec.width, '用語集の欄の幅').toBeLessThanOrEqual(640);
      for (const t of f.terms) expect(f.spec.nodes.some((n) => n.term === t), `${t} の箱`).toBe(true);
      for (const n of f.spec.nodes) if (n.term) expect(f.terms, `${n.id} の term`).toContain(n.term);
      // 強調は term が受け持つ (accent を直に書くと、別の用語を見ているときも主役の色になる)
      expect(f.spec.nodes.some((n) => n.tone === 'accent')).toBe(false);
      expectGoodLayout(f.spec);
    });
  }
});
