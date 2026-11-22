import { describe, expect, it } from 'vitest';
import {
  FREEZE_EVERY,
  MAX_FREEZES,
  MAX_USED,
  addDays,
  advanceStreak,
  completeReview,
  currentStreak,
  emptyProgress,
  freezeStatus,
  freezeText,
  normalizeProgress,
  type Progress,
  type Streak,
} from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T12:00:00`);

/** start から days の日に学ぶ (日付の並び) */
function studyOn(days: string[], p: Progress = emptyProgress()): Progress {
  return days.reduce((acc, d) => completeReview(acc, 3, at(d)), p);
}

const run = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i));

describe('休みの札', () => {
  it('学んだ日が 7 日たまるごとに 1 個、2 個まで', () => {
    expect(studyOn(run('2026-11-01', FREEZE_EVERY - 1)).streak.freezes).toBeUndefined();
    const week = studyOn(run('2026-11-01', FREEZE_EVERY));
    expect(week.streak.freezes).toBe(1);
    expect(week.streak.toNext).toBeUndefined();
    const three = studyOn(run('2026-11-01', FREEZE_EVERY * 3));
    expect(three.streak.freezes).toBe(MAX_FREEZES);
    expect(three.streak.count).toBe(21);
  });

  it('同じ日に何度学んでも 1 日と数える', () => {
    const p = studyOn(['2026-11-01', '2026-11-01', '2026-11-01']);
    expect(p.streak.toNext).toBe(1);
    expect(p.streak.count).toBe(1);
  });

  it('休んだ日があれば、次に学んだときにその日数分を使って連続を保つ (休んだ日は数えない)', () => {
    const p = studyOn(run('2026-11-01', 14)); // 札 2 個、連続 14
    expect(p.streak.freezes).toBe(2);
    // 11/15・11/16 を休み、11/17 に学ぶ
    const after = studyOn(['2026-11-17'], p);
    expect(after.streak.count).toBe(15);
    expect(after.streak.freezes).toBeUndefined();
    expect(after.streak.used).toEqual(['2026-11-15', '2026-11-16']);
  });

  it('札が足りなければ使わずに切れる (1 から)', () => {
    const p = studyOn(run('2026-11-01', 7)); // 札 1 個
    const after = studyOn(['2026-11-10'], p); // 11/08・11/09 の 2 日を休んだ
    expect(after.streak.count).toBe(1);
    expect(after.streak.freezes).toBe(1);
    expect(after.streak.used).toBeUndefined();
  });

  it('使ってから、たまる (札 0 個で 7 日目に休みを挟むと切れる)', () => {
    const p = studyOn(run('2026-11-01', 6)); // 札 0、次まで 6
    const after = studyOn(['2026-11-08'], p); // 11/07 を休んだ。今日で 7 日目なので札は今日の後に増える
    expect(after.streak.count).toBe(1);
    expect(after.streak.freezes).toBe(1);
  });

  it('埋められるうちは連続を出し、今日学ぶと使う数を出す', () => {
    const p = studyOn(run('2026-11-01', 14));
    expect(currentStreak(p, at('2026-11-16'))).toBe(14); // 11/15 を休んだ
    expect(freezeStatus(p, at('2026-11-16')).pending).toBe(1);
    expect(currentStreak(p, at('2026-11-17'))).toBe(14);
    expect(freezeStatus(p, at('2026-11-17')).pending).toBe(2);
    expect(currentStreak(p, at('2026-11-18'))).toBe(0); // 3 日は埋められない
    expect(freezeStatus(p, at('2026-11-18')).pending).toBe(0);
    expect(freezeStatus(p, at('2026-11-15')).pending).toBe(0); // 昨日学んだ
  });

  it('表示の文', () => {
    expect(freezeText({ have: 0, used: [], pending: 0 })).toBe('休みの札 0 / 2');
    expect(freezeText({ have: 1, used: ['2026-11-05', '2026-11-15', '2026-11-16', '2026-11-20'], pending: 1 })).toBe('休みの札 1 / 2 · 今日学ぶと 1 個使う · 11/15・11/16・11/20 に使った');
  });

  it('使った日は新しい 14 日だけ残す', () => {
    let s: Streak = { count: 5, lastDay: '2026-11-01', freezes: 2 };
    for (let i = 0; i < 10; i++) {
      s = advanceStreak({ ...s, freezes: 2 }, addDays(s.lastDay!, 3));
    }
    expect(s.used).toHaveLength(MAX_USED);
    expect(s.used![MAX_USED - 1]).toBe(addDays(s.lastDay!, -1));
  });

  it('札の欄が無い前の版の記録はそのまま読み、0 個から数える', () => {
    const old = normalizeProgress({ v: 1, streak: { count: 4, lastDay: '2026-11-20' }, xp: { total: 0, byDay: {} }, lessons: {}, answers: {} })!;
    expect(old.streak).toEqual({ count: 4, lastDay: '2026-11-20' });
    expect(freezeStatus(old, at('2026-11-22')).have).toBe(0);
    expect(currentStreak(old, at('2026-11-22'))).toBe(0);
  });

  it('札の欄を読み直しても同じ。形の違う値は捨てる', () => {
    const p = studyOn(['2026-11-17'], studyOn(run('2026-11-01', 14)));
    const back = normalizeProgress(JSON.parse(JSON.stringify(p)))!;
    expect(back.streak).toEqual(p.streak);
    const bad = normalizeProgress({ v: 1, streak: { count: 1, lastDay: '2026-11-20', freezes: 9, toNext: 30, used: ['2026-02-31', 'x', '2026-11-01', '2026-11-01'] }, xp: { total: 0, byDay: {} }, lessons: {}, answers: {} })!;
    expect(bad.streak).toEqual({ count: 1, lastDay: '2026-11-20', freezes: MAX_FREEZES, toNext: FREEZE_EVERY - 1, used: ['2026-11-01'] });
  });
  it('日付が戻ったとき (時刻帯を西へ移った) は同じ日とみなし、連続も札も数え直さない (R-004)', () => {
    const s: Streak = { count: 5, lastDay: '2026-11-21', freezes: 1, toNext: 3 };
    const back = advanceStreak(s, '2026-11-20');
    expect(back).toEqual(s);
    // 翌日 (元の日付) にも、もう一度数えない
    expect(advanceStreak(back, '2026-11-21')).toEqual(s);
    expect(advanceStreak(back, '2026-11-22')).toEqual({ count: 6, lastDay: '2026-11-22', freezes: 1, toNext: 4 });
    const p = { ...emptyProgress(), streak: s };
    expect(currentStreak(p, at('2026-11-20'))).toBe(5);
  });

  it('連続が 0 の記録では札を使わない (R-006)', () => {
    const s = advanceStreak({ count: 0, lastDay: '2026-11-20', freezes: 2 }, '2026-11-22');
    expect(s.count).toBe(1);
    expect(s.freezes).toBe(2);
    expect(s.used).toBeUndefined();
  });
});
