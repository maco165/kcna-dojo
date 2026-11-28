import { describe, expect, it } from 'vitest';
import type { LessonMeta } from '../src/content/types';
import { WEEKS } from '../src/content/curriculum';
import { domainAccuracy, doneLessons, exercisesOf, labsOf, lessonCaption, lessonCorrect, lessonStatuses, planStatus, weeklyXp } from '../src/lib/lessonStatus';
import { addDays, emptyProgress, type Progress } from '../src/lib/progress';

const lessons: LessonMeta[] = WEEKS[0].content!.lessons;
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

describe('問題演習と実習の分け方', () => {
  it('週の問題演習に実習は入らず、実習は別に並ぶ。終えた数も別に数える', () => {
    for (const w of WEEKS) {
      const all = w.content!.lessons;
      const ids = exercisesOf(w).map((l) => l.id);
      expect(ids).toEqual(all.map((l) => l.id).filter((id) => !id.endsWith('-lab')));
      expect(labsOf(w).map((l) => l.id)).toEqual([`w${w.week}-lab`]);
    }
    const p = withDone(['w1-l1', 'w1-lab']);
    expect(doneLessons(exercisesOf(WEEKS[0]), p)).toBe(1);
    expect(doneLessons(labsOf(WEEKS[0]), p)).toBe(1);
  });
  it('問題演習を全部終えれば、実習が残っていても「次」は無い', () => {
    const ex = exercisesOf(WEEKS[0]);
    expect(lessonStatuses(ex, withDone(ex.map((l) => l.id)))).not.toContain('next');
    expect(lessonStatuses(ex, emptyProgress())).toHaveLength(ex.length);
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

  /** 開始日を 2026-11-23 に決めた人の記録 */
  const startedOn = (p: Progress, day = '2026-11-23'): Progress => ({ ...p, profile: { dailyGoalXp: 30, startDate: day } });

  it('計画: 開始日から数えて 7 日目を過ぎた週のレッスンだけを、終わっているはずの数に入れる', () => {
    const week1Quiz = lessons.filter((l) => l.kind === 'quiz');
    expect(planStatus(startedOn(emptyProgress()), at('2026-11-29'))).toEqual({ expected: 0, done: 0 });
    expect(planStatus(startedOn(withDone(['w1-l1', 'w1-l2'])), at('2026-11-30'))).toEqual({ expected: week1Quiz.length, done: 2 });
    // 開始日を 1 週あとにした人は、同じ日でもまだ遅れていない
    expect(planStatus(startedOn(withDone(['w1-l1', 'w1-l2']), '2026-11-30'), at('2026-11-30')).expected).toBe(0);
  });

  it('計画: 開始日を決めていなければ初めて学んだ日から、まだ学んでいなければ今日から数える (運営者の予定の日付に固定しない)', () => {
    // 学んだ記録が無い人は、いつ開いても遅れていない
    expect(planStatus(emptyProgress(), at('2027-06-01')).expected).toBe(0);
    // 2027-05-03 に初めて学んだ人は、5/10 に第 1 週が終わっているはず
    const p = withDone(['w1-l1']);
    p.lessons['w1-l1'].at = '2027-05-03T03:00:00.000Z';
    expect(planStatus(p, at('2027-05-09')).expected).toBe(0);
    expect(planStatus(p, at('2027-05-10')).expected).toBe(lessons.filter((l) => l.kind === 'quiz').length);
  });

  it('計画: 後から足したレッスン (since) は、足す前に週を終えた人の遅れに数えない。足したあとに週を終える人には数える', () => {
    const added = WEEKS.flatMap((w) => (w.content?.lessons ?? []).filter((l) => l.kind === 'quiz' && l.since).map((l) => ({ id: l.id, since: (l as { since?: string }).since!, week: w.week })));
    expect(added.map((x) => x.id)).toEqual(['w6-l5', 'w7-l5', 'w8-l5']);
    const older = WEEKS.flatMap((w) => (w.content?.lessons ?? []).filter((l) => l.kind === 'quiz' && !(l as { since?: string }).since).map((l) => l.id));
    // 2026-10-09 に始めた人: 第 6 週は 11-13〜11-19、第 8 週は 11-27〜12-03。足す前のレッスンを全部終えている
    const early = startedOn(withDone(older), '2026-10-09');
    expect(planStatus(early, at('2026-12-01'))).toEqual({ expected: older.filter((id) => Number(id.slice(1, 2)) <= 7).length, done: older.filter((id) => Number(id.slice(1, 2)) <= 7).length });
    // 第 8 週の最後の日 (12-03) は足した日より後なので、w8-l5 は数える
    expect(planStatus(early, at('2026-12-10')).expected - planStatus(early, at('2026-12-10')).done).toBe(1);
    // 足した日に始めた人には、全部を数える
    const late = startedOn(withDone(older), '2026-11-28');
    expect(planStatus(late, at('2027-03-01'))).toEqual({ expected: older.length + added.length, done: older.length });
    // 境の日: 第 6 週の最後の日が since と同じ人には数えず、1 日あとの人には数える (since はデータから読む)
    const since = added[0].since;
    const startFor = (lastDayOfWeek6: string) => addDays(lastDayOfWeek6, -41);
    const w6 = (start: string) => planStatus(startedOn(withDone(older), start), at(addDays(start, 41 + 1)));
    expect(w6(startFor(since))).toEqual({ expected: older.filter((id) => Number(id.slice(1, 2)) <= 6).length, done: older.filter((id) => Number(id.slice(1, 2)) <= 6).length });
    expect(w6(startFor(addDays(since, 1))).expected - w6(startFor(addDays(since, 1))).done).toBe(1);
    // since の無いレッスンは今までどおり: 週の最後の日が過ぎれば数える
    expect(planStatus(startedOn(emptyProgress(), '2026-10-09'), at('2026-10-16')).expected).toBe(lessons.filter((l) => l.kind === 'quiz').length);
  });

  it('計画: 問題を全部終えて実習だけ残るなら遅れにしない (実習は数に入れない)', () => {
    const s = planStatus(startedOn(withDone(lessons.filter((l) => l.kind === 'quiz').map((l) => l.id))), at('2026-11-30'));
    expect(s).toEqual({ expected: lessons.length - 1, done: lessons.length - 1 });
  });
});
