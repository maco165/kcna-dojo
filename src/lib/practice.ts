// ランダム出題: 全週の問題 (または 1 分野) から、重ならずに数問を選ぶ
import type { Domain } from '../content/types';

export const PRACTICE_SIZES = [10, 20] as const;
export type PracticeDomain = Domain | 'all';

/** pool から n 問を重ならずに選ぶ (pool が少なければ全部)。並びも混ぜる */
export function pickPractice<T extends { domain: Domain }>(pool: T[], n: number, domain: PracticeDomain, random: () => number = Math.random): T[] {
  const a = pool.filter((x) => domain === 'all' || x.domain === domain);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
