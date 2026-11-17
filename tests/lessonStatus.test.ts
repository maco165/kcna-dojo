import { describe, expect, it } from 'vitest';
import type { Lesson } from '../src/content/types';
import { WEEKS } from '../src/content/curriculum';
import { domainAccuracy, lessonCaption, lessonCorrect, lessonStatuses, planStatus, weeklyXp } from '../src/lib/lessonStatus';
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

describe('進捗の画面の数字', () => {
  const at = (day: string) => new Date(`${day}T09:00:00`);

  it('この 7 日の XP を古い順に、無い日は 0 で並べる', () => {
    const p = emptyProgress();
    p.xp.byDay = { '2026-11-24': 9, '2026-11-30': 12, '2026-11-20': 99 };
    const days = weeklyXp(p, at('2026-11-30'));
    expect(days.map((d) => d.day)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']);
    expect(days.map((d) => d.xp)).toEqual([9, 0, 0, 0, 0, 0, 12]);
  });

  it('この 7 日の XP は月と年をまたいでも日付が続く', () => {
    const p = emptyProgress();
    expect(weeklyXp(p, at('2026-12-03')).map((d) => d.day)).toEqual(['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03']);
    expect(weeklyXp(p, at('2027-01-02')).map((d) => d.day)).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('計画: 週の終わり (日曜) を過ぎた週のレッスンだけを、終わっているはずの数に入れる', () => {
    const week1Quiz = lessons.filter((l) => l.kind === 'quiz');
    const week1Labs = lessons.length - week1Quiz.length;
    expect(planStatus(emptyProgress(), at('2026-11-29'))).toEqual({ expected: 0, done: 0, labsLeft: 0 });
    expect(planStatus(withDone(['w1-l1', 'w1-l2']), at('2026-11-30'))).toEqual({ expected: week1Quiz.length, done: 2, labsLeft: week1Labs });
  });

  it('計画: 問題を全部終えて実習だけ残るなら遅れにしない', () => {
    const s = planStatus(withDone(lessons.filter((l) => l.kind === 'quiz').map((l) => l.id)), at('2026-11-30'));
    expect(s.done).toBe(s.expected);
    expect(s.labsLeft).toBeGreaterThan(0);
  });
});
