import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../src/content/guide';
import { HANDBOOK_TOPICS, isAppendixDomain } from '../src/content/handbook';
import { WEEK_CONTENTS } from '../src/content/lessons';
import { WEEKS } from '../src/content/curriculum';

// 問題演習のレッスンと学習要領の細目 (正本は src/content/guide.ts の CURRICULUM)
const quiz = WEEK_CONTENTS.flatMap((w) => w.lessons.filter((l) => l.kind === 'quiz').map((l) => ({ ...l, week: w.week })));
const all = CURRICULUM.flatMap((c) => c.competencies.map((x) => ({ domain: c.domain, en: x.en, weeks: x.weeks })));

describe('レッスンの細目', () => {
  it('どの問題演習のレッスンも、CURRICULUM の細目を 1 つ持ち、その細目の分野はレッスンの分野と同じ', () => {
    for (const l of quiz) {
      const c = all.find((x) => x.en === l.competency);
      expect(c, `${l.id}: ${l.competency}`).toBeDefined();
      expect(c!.domain, l.id).toBe(l.domain);
    }
  });
  it('13 細目すべてに、細目を持つレッスンが 1 本以上ある', () => {
    expect(all).toHaveLength(13);
    const missing = all.filter((c) => !quiz.some((l) => l.competency === c.en)).map((c) => c.en);
    expect(missing).toEqual([]);
  });
  it('レッスンは、同じ細目のハンドブックのトピックの練習に入っている (付け方がハンドブックと食い違わない)', () => {
    const topicOf = new Map(HANDBOOK_TOPICS.filter((t) => !isAppendixDomain(t.domain)).map((t) => [t.competency, t]));
    for (const l of quiz) expect(topicOf.get(l.competency!)!.lessons, `${l.id} (${l.competency})`).toContain(l.id);
  });
  it('レッスンの週は、その細目を学ぶ週 (CURRICULUM の weeks) のどれか', () => {
    for (const l of quiz) expect(all.find((x) => x.en === l.competency)!.weeks, `${l.id} (${l.competency})`).toContain(l.week);
  });
  it('最初に読む軽い形 (?light) には細目を入れない', () => {
    for (const w of WEEKS) for (const l of w.content?.lessons ?? []) expect('competency' in l, l.id).toBe(false);
  });
});
