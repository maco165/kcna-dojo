import { describe, expect, it } from 'vitest';
import { completeReview, emptyProgress, normalizeProgress, setProfile, weekProgress } from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T12:00:00`);

describe('週の目標', () => {
  it('既定は決めない。決めると読み直しても残り、なしで消える', () => {
    expect(weekProgress(emptyProgress(), at('2026-11-25')).goal).toBeUndefined();
    const p = setProfile(emptyProgress(), { weeklyDays: 3 });
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))!.profile!.weeklyDays).toBe(3);
    expect(setProfile(p, { weeklyDays: undefined }).profile).not.toHaveProperty('weeklyDays');
  });

  it('1〜7 以外は読まない (前の版の profile もそのまま読む)', () => {
    const raw = { v: 1, streak: { count: 0, lastDay: null }, xp: { total: 0, byDay: {} }, lessons: {}, answers: {} };
    expect(normalizeProgress({ ...raw, profile: { dailyGoalXp: 20, weeklyDays: 9 } })!.profile).toEqual({ dailyGoalXp: 20 });
    expect(normalizeProgress({ ...raw, profile: { dailyGoalXp: 20, weeklyDays: 0 } })!.profile).toEqual({ dailyGoalXp: 20 });
    expect(normalizeProgress({ ...raw, profile: { dailyGoalXp: 20 } })!.profile).toEqual({ dailyGoalXp: 20 });
  });

  it('今週は月曜から今日まで。学んだ日 (終えた日) を 1 日 1 回数える', () => {
    let p = setProfile(emptyProgress(), { weeklyDays: 4 });
    // 2026-11-23 が月曜。前の週の日曜 (11/22) は数えない
    for (const d of ['2026-11-22', '2026-11-23', '2026-11-23', '2026-11-25']) p = completeReview(p, 3, at(d));
    expect(weekProgress(p, at('2026-11-25'))).toEqual({ days: 2, goal: 4 });
    expect(weekProgress(p, at('2026-11-29'))).toEqual({ days: 2, goal: 4 }); // 日曜まで同じ週
    expect(weekProgress(p, at('2026-11-30')).days).toBe(0); // 次の月曜で 0 から
    expect(weekProgress(p, at('2026-11-22')).days).toBe(1); // 日曜は前の週 (11/16〜)
  });
});
