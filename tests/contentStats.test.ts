import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import { EXAM_FACTS, SAMPLE_QUESTION_ID, SOURCES } from '../src/content/guide';
import { findQuestion } from '../src/content';
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
      WEEKS.map((w) => w.content),
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
    for (const f of EXAM_FACTS) expect(new URL(f.source.url).protocol).toBe('https:');
  });
});
