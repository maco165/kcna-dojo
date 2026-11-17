import { describe, expect, it } from 'vitest';
import type { ChoiceQuestion, FillQuestion } from '../src/content/types';
import { questionText } from '../src/lib/askAi';
import { gradeChoice } from '../src/lib/grade';
import { shuffleChoices } from '../src/lib/shuffle';

const choice: ChoiceQuestion = {
  id: 'c1',
  type: 'choice',
  prompt: 'Pod の説明は?',
  choices: [
    { id: 'a', text: 'ノード' },
    { id: 'b', text: 'いちばん小さな単位' },
    { id: 'c', text: 'Deployment' },
    { id: 'd', text: 'コンテナ' },
  ],
  answer: 'b',
  explanation: 'x',
  source: 'https://kubernetes.io/',
};

/** 決まった数を順に返す乱数 (並びを決め打ちにする) */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('shuffleChoices', () => {
  it('選択肢を並べ替え、元の問題は変えない', () => {
    const s = shuffleChoices(choice, seq(0, 0, 0)); // 毎回 j=0 → [b, c, d, a]
    expect(s.choices.map((c) => c.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(choice.choices.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('同じ選択肢がそろったまま (なくなったり増えたりしない)', () => {
    for (let k = 0; k < 50; k++) {
      const s = shuffleChoices(choice);
      expect([...s.choices].map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('並べ替えても採点は選択肢の id で合う', () => {
    const s = shuffleChoices(choice, seq(0, 0, 0));
    expect(gradeChoice(s, 'b')).toBe(true);
    expect(gradeChoice(s, 'a')).toBe(false);
  });

  it('AI に聞く文の記号は、画面の並びに合わせる', () => {
    const s = shuffleChoices(choice, seq(0, 0, 0)); // A=b, B=c, C=d, D=a
    const t = questionText(s, { picked: 'a', correct: false });
    expect(t).toContain('A. いちばん小さな単位');
    expect(t).toContain('D. ノード');
    expect(t).toContain('私の答えは D で不正解でした (正解は A)');
  });

  it('fixedOrder の 4 択と穴埋めはそのまま', () => {
    const fixed = { ...choice, fixedOrder: true };
    expect(shuffleChoices(fixed, seq(0, 0, 0))).toBe(fixed);
    const fill: FillQuestion = {
      id: 'f1',
      type: 'fill',
      prompt: 'x',
      language: 'bash',
      code: 'kubectl {{blank}}',
      answers: ['get'],
      explanation: 'x',
      source: 'https://kubernetes.io/',
    };
    expect(shuffleChoices(fill, seq(0))).toBe(fill);
  });

  it('何度も混ぜると、いろいろな並びが出る', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 200; k++) seen.add(shuffleChoices(choice).choices.map((c) => c.id).join(''));
    expect(seen.size).toBeGreaterThan(10); // 4! = 24 通りのうち
  });
});
