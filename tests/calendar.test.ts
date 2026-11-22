import { describe, expect, it } from 'vitest';
import { CALENDAR_WEEKS, calendarWeeks, cellLabel, levelOf, mondayOf, reviewForecast } from '../src/lib/calendar';
import { completeReview, emptyProgress, normalizeProgress, recordAnswer, type Progress } from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T12:00:00`);

describe('日ごとの答えた問題の数', () => {
  it('答えるたびにその日の数を 1 足す (正解でも不正解でも)', () => {
    let p = recordAnswer(emptyProgress(), 'w1-l1-q1', true, at('2026-11-20'));
    p = recordAnswer(p, 'w1-l1-q2', false, at('2026-11-20'));
    p = recordAnswer(p, 'w1-l1-q1', true, at('2026-11-21'));
    expect(p.solved).toEqual({ '2026-11-20': 2, '2026-11-21': 1 });
  });

  it('前の版の記録 (solved が無い) も読め、読み直しても同じ。形の違う値は捨てる', () => {
    const old = normalizeProgress({ v: 1, streak: { count: 0, lastDay: null }, xp: { total: 3, byDay: { '2026-11-01': 3 } }, lessons: {}, answers: {} })!;
    expect(old.solved).toBeUndefined();
    const p = normalizeProgress({ ...old, solved: { '2026-11-01': 4, '2026-02-31': 1, '2026-11-02': -1, x: 2, '2026-11-03': 0 } })!;
    expect(p.solved).toEqual({ '2026-11-01': 4 });
  });
});

describe('カレンダー', () => {
  it('段は 1〜5・6〜15・16〜40・41 から。数の記録が無くても学んだ日は 1', () => {
    expect([0, 1, 5, 6, 15, 16, 40, 41, 200].map((n) => levelOf(n, false))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(levelOf(0, true)).toBe(1);
  });

  it('月曜始まりで 26 週。今日より後は描かない', () => {
    expect(mondayOf('2026-11-23')).toBe('2026-11-23'); // 月曜
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // 日曜
    const weeks = calendarWeeks(emptyProgress(), at('2026-11-25')); // 水曜
    expect(weeks).toHaveLength(CALENDAR_WEEKS);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[CALENDAR_WEEKS - 1][0].day).toBe('2026-11-23');
    expect(weeks[CALENDAR_WEEKS - 1].map((c) => c.future)).toEqual([false, false, false, true, true, true, true]);
    expect(weeks[0][0].day).toBe('2026-06-01');
  });

  it('答えた数と、前の版の学んだ日 (XP だけ) をマスにする', () => {
    let p: Progress = normalizeProgress({ v: 1, streak: { count: 1, lastDay: '2026-11-10' }, xp: { total: 3, byDay: { '2026-11-10': 3 } }, lessons: {}, answers: {} })!;
    for (let i = 0; i < 20; i++) p = recordAnswer(p, `q${i}`, true, at('2026-11-20'));
    p = completeReview(p, 60, at('2026-11-20'));
    const cells = calendarWeeks(p, at('2026-11-25')).flat();
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get('2026-11-20')).toMatchObject({ count: 20, level: 3 });
    expect(byDay.get('2026-11-10')).toMatchObject({ count: 0, level: 1 });
    expect(byDay.get('2026-11-11')).toMatchObject({ count: 0, level: 0 });
    expect(cellLabel(byDay.get('2026-11-20')!)).toBe('11月20日(金) 20 問');
    expect(cellLabel(byDay.get('2026-11-10')!)).toBe('11月10日(火) 学んだ (問題の数の記録なし)');
    expect(cellLabel(byDay.get('2026-11-11')!)).toBe('11月11日(水) 学んでいない');
  });
});

describe('この先 14 日の復習', () => {
  it('明日から 14 日の予定の日ごとの件数。今日まで・15 日より後・知らない問題は数えない', () => {
    let p = emptyProgress();
    p = recordAnswer(p, 'a', false, at('2026-11-20')); // 11/21
    p = recordAnswer(p, 'b', false, at('2026-11-20')); // 11/21
    p = recordAnswer(p, 'gone', false, at('2026-11-20')); // 11/21 (問題データに無い)
    p = { ...p, answers: { ...p.answers, c: { right: 3, wrong: 1, last: '', stage: 2, nextReview: '2026-11-27' }, d: { right: 0, wrong: 1, last: '', stage: 0, nextReview: '2026-11-20' }, e: { right: 1, wrong: 1, last: '', stage: 2, nextReview: '2026-12-05' } } };
    const f = reviewForecast(p, at('2026-11-20'), (id) => id !== 'gone');
    expect(f).toHaveLength(14);
    expect(f[0]).toEqual({ day: '2026-11-21', count: 2 });
    expect(f.find((x) => x.day === '2026-11-27')!.count).toBe(1);
    expect(f[13].day).toBe('2026-12-04');
    expect(f.reduce((s, x) => s + x.count, 0)).toBe(3);
  });
});
