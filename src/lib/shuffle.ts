import type { Question } from '../content/types';

/**
 * 4 択の選択肢の並びを混ぜた写しを返す (Fisher-Yates)。元の問題は変えない。
 * 採点と記録は選択肢の id で行うので、並びを変えても正誤は崩れない。
 * 穴埋めの問題と fixedOrder の 4 択はそのまま返す。random はテストで差し替える。
 */
export function shuffleChoices<Q extends Question>(q: Q, random: () => number = Math.random): Q {
  if (q.type !== 'choice' || q.fixedOrder) return q;
  const choices = [...q.choices];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { ...q, choices };
}
