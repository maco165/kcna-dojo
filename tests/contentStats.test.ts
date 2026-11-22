import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import { CURRICULUM, EXAM_FACTS, SAMPLE_QUESTION_ID, SOURCES, SOURCE_SITES, STUDY_MATERIALS } from '../src/content/guide';
import { EXAM_WEIGHTS } from '../src/lib/exam';
import { WEEK_CONTENTS, findQuestion } from '../src/content/lessons';
import type { WeekContent } from '../src/content/types';
import { contentStats } from '../src/lib/contentStats';

const week = (sources: string[], labs = 0): WeekContent =>
  ({
    week: 1,
    lessons: [
      { id: 'l1', kind: 'quiz', domain: 'Kubernetes Fundamentals', questions: sources.map((source, i) => ({ id: `q${i}`, source })) },
      ...Array.from({ length: labs }, (_, i) => ({ id: `lab${i}`, kind: 'lab' })),
    ],
  }) as unknown as WeekContent;

describe('contentStats', () => {
  it('週・レッスン・問題・用語を数え、出典をホストごとに多い順に並べる', () => {
    const s = contentStats([week(['https://a.io/1', 'https://b.io/1', 'https://a.io/2'], 1), undefined], 5);
    expect(s).toMatchObject({ weeks: 1, lessons: 2, labs: 1, questions: 3, terms: 5 });
    expect(s.sources).toEqual([
      { host: 'a.io', count: 2 },
      { host: 'b.io', count: 1 },
    ]);
  });
  it('実データ: 出典の合計が問題の数と同じで、kubernetes.io がいちばん多い', () => {
    const s = contentStats(
      WEEK_CONTENTS,
      0,
    );
    expect(s.sources.reduce((a, b) => a + b.count, 0)).toBe(s.questions);
    expect(s.sources[0].host).toBe('kubernetes.io');
  });
});

describe('説明のページの事実', () => {
  it('見本の問題は実在する穴埋めの問題', () => {
    expect(findQuestion(SAMPLE_QUESTION_ID)?.question.type).toBe('fill');
  });
  it('事実と出典はすべて https', () => {
    for (const s of Object.values(SOURCES)) expect(new URL(s.url).protocol).toBe('https:');
    for (const f of EXAM_FACTS) for (const x of f.sources) expect(new URL(x.url).protocol).toBe('https:');
  });
});

describe('学習要領と情報源', () => {
  it('細目の週は、その分野の週 (問題データの分野) に入っている', () => {
    for (const c of CURRICULUM) {
      for (const x of c.competencies) for (const w of x.weeks) expect(WEEKS.find((k) => k.week === w)?.domain, `${x.en} → 第 ${w} 週`).toBe(c.domain);
    }
  });
  it('学習要領の分野は配点の 4 分野と同じで、細目の週はすべて実在する', () => {
    expect(CURRICULUM.map((c) => c.domain).sort()).toEqual(Object.keys(EXAM_WEIGHTS).sort());
    const weeks = new Set(WEEKS.map((w) => w.week));
    for (const c of CURRICULUM) for (const x of c.competencies) for (const w of x.weeks) expect(weeks.has(w)).toBe(true);
  });
  it('問題の出典のサイトには、すべて名前と入口の URL がある (名前の無いホストを出さない)', () => {
    const s = contentStats(
      WEEK_CONTENTS,
      0,
    );
    for (const x of s.sources) expect(SOURCE_SITES[x.host], x.host).toBeDefined();
  });
  it('情報源と学習素材の URL は https', () => {
    for (const x of [...Object.values(SOURCE_SITES), ...STUDY_MATERIALS]) expect(new URL(x.url).protocol).toBe('https:');
  });
});
