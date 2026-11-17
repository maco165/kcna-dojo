import { describe, expect, it } from 'vitest';
import type { Lesson } from '../src/content/types';
import { WEEKS } from '../src/content/curriculum';
import { domainAccuracy, lessonCaption, lessonCorrect, lessonStatuses } from '../src/lib/lessonStatus';
import { emptyProgress, type Progress } from '../src/lib/progress';

const lessons = WEEKS[0].content!.lessons as Lesson[];
const quiz = lessons[0];
const lab = lessons.find((l) => l.kind === 'lab')!;

function withDone(ids: string[], best = 1): Progress {
  const p = emptyProgress();
  for (const id of ids) p.lessons[id] = { done: true, best, at: '' };
  return p;
}

describe('lessonStatuses', () => {
  it('まだ終えていない最初のレッスンだけが next', () => {
    expect(lessonStatuses(lessons, emptyProgress())).toEqual(['next', 'pending', 'pending', 'pending', 'pending']);
    expect(lessonStatuses(lessons, withDone(['w1-l1', 'w1-l3']))).toEqual(['done', 'next', 'done', 'pending', 'pending']);
  });

  it('全部終えると next は無い', () => {
    expect(lessonStatuses(lessons, withDone(lessons.map((l) => l.id)))).not.toContain('next');
  });
});

describe('lessonCorrect (最高の正答)', () => {
  it('終えていなければ —', () => {
    expect(lessonCorrect(quiz, emptyProgress())).toBe('—');
  });

  it('いちばん良かった正答率を問題数に掛けて丸める', () => {
    expect(lessonCorrect(quiz, withDone([quiz.id], 0.8))).toBe('4 / 5');
    expect(lessonCorrect(quiz, withDone([quiz.id], 0.6))).toBe('3 / 5');
  });

  it('実習は手順の数で出す', () => {
    const steps = lab.kind === 'lab' ? lab.steps.length : 0;
    expect(lessonCorrect(lab, withDone([lab.id]))).toBe(`${steps} / ${steps}`);
  });
});

describe('domainAccuracy', () => {
  it('答えていない分野は null', () => {
    const acc = domainAccuracy(emptyProgress());
    expect(Object.values(acc).every((v) => v === null)).toBe(true);
  });

  it('答えた回数の合計に対する正解の割合', () => {
    const p = emptyProgress();
    p.answers['w1-l1-q1'] = { right: 1, wrong: 0, last: '' };
    p.answers['w1-l1-q2'] = { right: 1, wrong: 2, last: '' };
    const acc = domainAccuracy(p);
    expect(acc['Kubernetes Fundamentals']).toBeCloseTo(2 / 4);
    expect(acc['Container Orchestration']).toBeNull();
  });
});

describe('lessonCaption', () => {
  it('週の番号を除いた id と summary を並べる', () => {
    expect(lessonCaption(quiz)).toBe(`l1 · ${quiz.summary}`);
  });
});
