import type { Question } from '../content/types';

/**
 * 4 択の選択肢の並びを混ぜた写しを返す (Fisher-Yates)。元の問題は変えない。
 * 採点と記録は選択肢の id で行うので、並びを変えても正誤は崩れない。
 * 穴埋めは候補を混ぜる。fixedOrder の 4 択はそのまま返す。random はテストで差し替える。
 */
export function shuffleChoices<Q extends Question>(q: Q, random: () => number = Math.random): Q {
  // 穴埋めの候補も混ぜる (データの順のままだと、1 つ目が正解になりがちで手がかりになる)
  if (q.type === 'fill') return q.candidates ? { ...q, candidates: shuffled(q.candidates, random) } : q;
  if (q.fixedOrder) return q;
  return { ...q, choices: shuffled(q.choices, random) };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
