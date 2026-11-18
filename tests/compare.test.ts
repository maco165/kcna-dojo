import { describe, expect, it } from 'vitest';
import glossary from '../src/content/glossary.json';
import { COMPARE_TABLES, tablesOfTerm } from '../src/content/compare';
import { parseRoute, compareHref } from '../src/lib/route';

const TERMS = new Set((glossary as { terms: { id: string }[] }).terms.map((t) => t.id));

describe('似た語の比較表', () => {
  it('id は重ならず、行のセルの数は列の数と同じで、列の語は用語集にある', () => {
    const ids = COMPARE_TABLES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of COMPARE_TABLES) {
      expect(/^[a-z0-9-]+$/.test(t.id), t.id).toBe(true);
      expect(t.columns.length, t.id).toBeGreaterThanOrEqual(2);
      for (const r of t.rows) expect(r.cells.length, `${t.id} ${r.label}`).toBe(t.columns.length);
      for (const c of t.columns) if (c.term) expect(TERMS.has(c.term), `${t.id} ${c.term}`).toBe(true);
      expect(t.pitfalls.length, t.id).toBeGreaterThan(0);
      expect(t.example.length, t.id).toBeGreaterThan(0);
      expect(t.sources.length, t.id).toBeGreaterThan(0);
      for (const s of t.sources) expect(new URL(s.url).protocol, `${t.id} ${s.url}`).toBe('https:');
    }
  });
  it('経路: /compare/ は一覧、/compare/<id>/ は表', () => {
    expect(parseRoute(compareHref())).toEqual({ name: 'compare' });
    expect(parseRoute(compareHref('workloads'))).toEqual({ name: 'compare', tableId: 'workloads' });
  });
  it('用語集の語から、その語を列に持つ表を引ける', () => {
    expect(tablesOfTerm('deployment').map((t) => t.id)).toContain('workloads');
  });
});
