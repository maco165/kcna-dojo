import { describe, expect, it } from 'vitest';
import { questionBank } from '../src/content/lessons';
import { EXAM_QUESTIONS, domainCounts, formatClock, gradeExam, isCorrect, pickExamQuestions, recordExam } from '../src/lib/exam';
import { MAX_EXAM_RECORDS, addExamRecord, emptyProgress, normalizeProgress } from '../src/lib/progress';

/** 決まった並びの乱数 (試験の結果を毎回同じにする) */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('domainCounts', () => {
  it('60 問を配点 44/28/16/12% で 26/17/10/7 に分ける', () => {
    expect(domainCounts(60)).toEqual({
      'Kubernetes Fundamentals': 26,
      'Container Orchestration': 17,
      'Cloud Native Application Delivery': 10,
      'Cloud Native Architecture': 7,
    });
  });
  it('どの数でも合計がそろう', () => {
    for (const n of [1, 7, 10, 33, 60, 100]) {
      expect(Object.values(domainCounts(n)).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe('pickExamQuestions', () => {
  const bank = questionBank();
  it('60 問を重ならずに選び、分野ごとの数が配点どおり', () => {
    const items = pickExamQuestions(bank, seeded(7));
    expect(items).toHaveLength(EXAM_QUESTIONS);
    expect(new Set(items.map((i) => i.question.id)).size).toBe(EXAM_QUESTIONS);
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.domain] = (counts[i.domain] ?? 0) + 1;
    expect(counts).toEqual(domainCounts(EXAM_QUESTIONS));
  });
  it('問題の束は各分野に足りる数がある', () => {
    const need = domainCounts(EXAM_QUESTIONS);
    for (const [d, n] of Object.entries(need)) {
      expect(bank.filter((b) => b.domain === d).length).toBeGreaterThanOrEqual(n);
    }
  });
});

describe('gradeExam', () => {
  const items = pickExamQuestions(questionBank(), seeded(3));
  const right = items.map(({ question: q }) => (q.type === 'fill' ? q.answers[0] : q.answer));
  it('全部正しければ満点', () => {
    const r = gradeExam(items, right);
    expect(r.correct).toBe(EXAM_QUESTIONS);
    expect(r.byDomain['Kubernetes Fundamentals']).toEqual({ right: 26, total: 26 });
  });
  it('答えなしは不正解', () => {
    const r = gradeExam(items, items.map(() => undefined));
    expect(r.correct).toBe(0);
    expect(r.total).toBe(EXAM_QUESTIONS);
    expect(isCorrect(items[0].question, undefined)).toBe(false);
  });
  it('1 問だけ外すと 59 点', () => {
    const answers = [...right];
    answers[0] = 'まちがい';
    expect(gradeExam(items, answers).correct).toBe(EXAM_QUESTIONS - 1);
  });
});

describe('formatClock', () => {
  it('分:秒で表し、負は 0:00', () => {
    expect(formatClock(90 * 60)).toBe('90:00');
    expect(formatClock(61.2)).toBe('1:02');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('addExamRecord と記録の検査', () => {
  it('新しい順に積み、上限で切る', () => {
    let p = emptyProgress();
    for (let i = 0; i < MAX_EXAM_RECORDS + 3; i++) p = addExamRecord(p, { at: new Date(2026, 0, 1 + i).toISOString(), correct: i, total: 60 });
    expect(p.exams).toHaveLength(MAX_EXAM_RECORDS);
    expect(p.exams?.[0].correct).toBe(MAX_EXAM_RECORDS + 2);
  });
  it('読み込みで壊れた試験の記録を捨てる', () => {
    const p = normalizeProgress({
      ...emptyProgress(),
      exams: [
        { at: '2026-11-18T00:00:00.000Z', correct: 45, total: 60 },
        { at: 'not a date', correct: 1, total: 60 },
        { at: '2026-11-18T00:00:00.000Z', correct: 61, total: 60 },
        { at: '2026-11-18T00:00:00.000Z', correct: 0, total: 0 },
        { at: '2026-11-18T00:00:00.000Z', correct: -1, total: 60 },
        'x',
      ],
    });
    expect(p?.exams).toEqual([{ at: '2026-11-18T00:00:00.000Z', correct: 45, total: 60 }]);
  });
});

describe('recordExam', () => {
  const items = pickExamQuestions(questionBank(), seeded(11));
  const right = items.map(({ question: q }) => (q.type === 'fill' ? q.answers[0] : q.answer));
  const now = new Date('2026-11-18T09:00:00');

  it('答えなしの問題は記録せず、途中の復習の段階を戻さない', () => {
    const p = emptyProgress();
    for (const { question } of items) p.answers[question.id] = { right: 2, wrong: 0, last: '2026-11-10', stage: 2, nextReview: '2099-01-01' };
    const next = recordExam(p, items, items.map(() => undefined), now);
    expect(next.answers).toEqual(p.answers);
    expect(next.exams?.[0]).toMatchObject({ correct: 0, total: EXAM_QUESTIONS });
  });
  it('空白だけの答えも答えなしとみなす', () => {
    const next = recordExam(emptyProgress(), items, items.map(() => '   '), now);
    expect(Object.keys(next.answers)).toHaveLength(0);
  });
  it('答えた問題は正誤を記録し、正解の数 × 3 XP を足す', () => {
    const answers: (string | undefined)[] = [...right];
    answers[0] = 'まちがい';
    answers[1] = undefined;
    const next = recordExam(emptyProgress(), items, answers, now);
    expect(Object.keys(next.answers)).toHaveLength(EXAM_QUESTIONS - 1);
    expect(next.answers[items[0].question.id].wrong).toBe(1);
    expect(next.xp.total).toBe((EXAM_QUESTIONS - 2) * 3);
    expect(next.exams?.[0].correct).toBe(EXAM_QUESTIONS - 2);
  });
});

describe('合格の目安 (KCNA の試験のページに合格点の数字が無いので、断定しない)', () => {
  it('模擬試験の説明と試験の形式の表は、75% を「目安」と書き、出所の但し書きを付ける', async () => {
    const { PASS_NOTE } = await import('../src/lib/exam');
    const { EXAM_FACTS } = await import('../src/content/guide');
    expect(PASS_NOTE).toContain('目安');
    expect(PASS_NOTE).toContain('KCNA と名指しではない');
    expect(PASS_NOTE).not.toMatch(/合格点です/);
    const pass = EXAM_FACTS.find((f) => f.label.startsWith('合格'))!;
    expect(pass.label).toBe('合格の目安');
    expect(pass.value).toContain('目安');
    expect(pass.note).toMatch(/数字は無い/);
  });
});
