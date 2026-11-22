import { describe, expect, it } from 'vitest';
import { allQuestionDomains, masteryByDomain } from '../src/lib/mastery';
import { questionBank } from '../src/content/lessons';
import { EXAM_ONLY } from '../src/content/examBank';
import { emptyProgress, masteryOf, normalizeProgress, recordAnswer, type AnswerRecord } from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T12:00:00`);
const rec = (r: Partial<AnswerRecord>): AnswerRecord => ({ right: 0, wrong: 0, last: '', ...r });

describe('問題ごとの到達', () => {
  it('答えるたびに続けて正解した数を数え、4 つに分ける', () => {
    let p = emptyProgress();
    expect(masteryOf(p.answers.q)).toBe('new');
    p = recordAnswer(p, 'q', true, at('2026-11-20'));
    expect(masteryOf(p.answers.q)).toBe('once');
    p = recordAnswer(p, 'q', true, at('2026-11-20'));
    expect(masteryOf(p.answers.q)).toBe('twice');
    p = recordAnswer(p, 'q', false, at('2026-11-21'));
    expect(p.answers.q.run).toBe(0);
    expect(masteryOf(p.answers.q)).toBe('wrong');
    // 間違えたあと、予定の日より前に正解しても (復習の段階は 0 のまま) 1 回正解になる
    p = recordAnswer(p, 'q', true, at('2026-11-21'));
    expect(p.answers.q.stage).toBe(0);
    expect(masteryOf(p.answers.q)).toBe('once');
  });

  it('run の無い前の版の記録は、正誤の数と復習の段階から推す', () => {
    expect(masteryOf(rec({ wrong: 2 }))).toBe('wrong');
    expect(masteryOf(rec({ right: 1 }))).toBe('once');
    expect(masteryOf(rec({ right: 3 }))).toBe('twice');
    expect(masteryOf(rec({ right: 1, wrong: 1, stage: 0, nextReview: '2026-11-22' }))).toBe('wrong');
    expect(masteryOf(rec({ right: 2, wrong: 1, stage: 1, nextReview: '2026-11-25' }))).toBe('once');
    expect(masteryOf(rec({ right: 3, wrong: 1, stage: 2, nextReview: '2026-11-29' }))).toBe('twice');
    expect(masteryOf(rec({ right: 4, wrong: 1 }))).toBe('twice'); // 復習を終えた
  });

  it('前の版の記録から続けて答えると、推した到達から数え始める', () => {
    const old = normalizeProgress({ v: 1, streak: { count: 0, lastDay: null }, xp: { total: 0, byDay: {} }, lessons: {}, answers: { q: { right: 2, wrong: 1, last: '', stage: 1, nextReview: '2026-11-20' } } })!;
    expect(old.answers.q.run).toBeUndefined();
    const p = recordAnswer(old, 'q', true, at('2026-11-20'));
    expect(p.answers.q.run).toBe(2);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))!.answers.q.run).toBe(2);
    expect(normalizeProgress({ ...old, answers: { q: { right: 1, wrong: 0, last: '', run: 99 } } })!.answers.q.run).toBe(9);
  });

  it('分野ごとの数はレッスンと模擬試験用の問題の全部で、分野は問題データと同じ', () => {
    const qs = allQuestionDomains();
    const full = [...questionBank(), ...EXAM_ONLY];
    expect(qs).toHaveLength(full.length);
    const domainOf = new Map(full.map((b) => [b.question.id, b.domain]));
    expect(qs.every((q) => domainOf.get(q.id) === q.domain)).toBe(true);
    const id = qs[0].id;
    const p = recordAnswer(emptyProgress(), id, true, at('2026-11-20'));
    const rows = masteryByDomain(p);
    expect(rows.map((r) => r.short)).toEqual(['Fundamentals', 'Orchestration', 'App Delivery', 'Architecture']);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(full.length);
    const row = rows.find((r) => r.domain === qs[0].domain)!;
    expect(row.counts.once).toBe(1);
    expect(row.counts.new).toBe(row.total - 1);
  });
});
