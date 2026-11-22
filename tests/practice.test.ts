import { describe, expect, it } from 'vitest';
import { allQuestions } from '../src/content/lessons';
import { pickPractice } from '../src/lib/practice';

/** 決まった並びを返す乱数 (テストを毎回同じにする) */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe('ランダム出題', () => {
  const all = allQuestions();
  it('すべての週の問題を数え、分野つきで返す', () => {
    expect(all.length).toBeGreaterThan(200);
    expect(new Set(all.map((q) => q.question.id)).size).toBe(all.length);
  });
  it('数だけ、重ならずに選ぶ', () => {
    const got = pickPractice(all, 20, 'all', seeded(1));
    expect(got).toHaveLength(20);
    expect(new Set(got.map((q) => q.question.id)).size).toBe(20);
  });
  it('分野を選ぶと、その分野の問題だけ', () => {
    const got = pickPractice(all, 10, 'Cloud Native Architecture', seeded(2));
    expect(got).toHaveLength(10);
    expect(got.every((q) => q.domain === 'Cloud Native Architecture')).toBe(true);
  });
  it('毎回同じ先頭からではなく、全体から選ぶ (元の並びのままにしない)', () => {
    const got = pickPractice(all, 10, 'all', seeded(3)).map((q) => q.question.id);
    expect(got).not.toEqual(all.slice(0, 10).map((q) => q.question.id));
    // 違う乱数なら違う組になる
    expect(got).not.toEqual(pickPractice(all, 10, 'all', seeded(4)).map((q) => q.question.id));
  });
  it('偏りの無い混ぜ方 (乱数が常に最大なら、どこも入れ替えず元の並びのまま)', () => {
    const pool = all.slice(0, 8);
    expect(pickPractice(pool, 8, 'all', () => 0.999).map((q) => q.question.id)).toEqual(pool.map((q) => q.question.id));
  });
  it('元の配列を変えず、少なければあるだけ返す', () => {
    const pool = all.slice(0, 5);
    const before = pool.map((q) => q.question.id);
    expect(pickPractice(pool, 10, 'all', seeded(5))).toHaveLength(5);
    expect(pool.map((q) => q.question.id)).toEqual(before);
  });
});
