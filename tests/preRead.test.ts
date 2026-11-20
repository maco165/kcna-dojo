import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import { HANDBOOK_TOPICS, isAppendixDomain } from '../src/content/handbook';

const scope = HANDBOOK_TOPICS.filter((t) => !isAppendixDomain(t.domain));
const byId = new Map(scope.map((t) => [t.id, t]));

describe('先に読むトピック (週 → ハンドブック)', () => {
  it('どの週にも 1 つ以上あり、試験の範囲のトピックを指し、呼び名は題名の頭', () => {
    for (const w of WEEKS) {
      expect(w.read.length, `第 ${w.week} 週`).toBeGreaterThan(0);
      expect(new Set(w.read.map((r) => r.topic)).size, `第 ${w.week} 週: 重なり`).toBe(w.read.length);
      for (const r of w.read) {
        const t = byId.get(r.topic);
        expect(t, `第 ${w.week} 週: ${r.topic} は試験の範囲のトピックにありません`).toBeDefined();
        expect(t!.title.startsWith(r.label), `第 ${w.week} 週: 「${r.label}」は「${t!.title}」の頭ではありません`).toBe(true);
      }
    }
  });
  it('先に読むトピックは、その週のレッスンを練習に持つ', () => {
    for (const w of WEEKS) {
      const ids = new Set((w.content?.lessons ?? []).map((l) => l.id));
      for (const r of w.read) expect(byId.get(r.topic)!.lessons.some((l) => ids.has(l)), `第 ${w.week} 週: ${r.topic}`).toBe(true);
    }
  });
  it('試験の範囲のトピックは、どれかの週の先に読むに入っている', () => {
    const read = new Set(WEEKS.flatMap((w) => w.read.map((r) => r.topic)));
    expect(scope.filter((t) => !read.has(t.id)).map((t) => t.id)).toEqual([]);
  });
  it('どのレッスン (実習も) も、試験の範囲のどれかのトピックの練習に入っている', () => {
    const linked = new Set(scope.flatMap((t) => t.lessons));
    const all = WEEKS.flatMap((w) => (w.content?.lessons ?? []).map((l) => l.id));
    expect(all.filter((id) => !linked.has(id))).toEqual([]);
  });
  it('レッスンは、自分の週の先に読むトピックのどれかに入っている', () => {
    for (const w of WEEKS) {
      const linked = new Set(w.read.flatMap((r) => byId.get(r.topic)!.lessons));
      expect((w.content?.lessons ?? []).map((l) => l.id).filter((id) => !linked.has(id)), `第 ${w.week} 週`).toEqual([]);
    }
  });
});
