// 答えたあとの「読み直す」: その問題に関係するハンドブックのトピックと、問題に出てくる用語集の語を選ぶ
import type { Question } from '../content/types';
import { makeTermLinker } from './termLinks';

type Term = { id: string; lessons: string[]; topics?: string[] };
type Topic = { id: string; lessons: string[]; domain: string };

/** 問題の id からレッスンの id (w1-l2-q4 → w1-l2)。模擬試験用の問題 (x-) はレッスンを持たない */
export const lessonOfQuestion = (id: string) => id.match(/^(w\d+-l\d+)-/)?.[1];

/**
 * どの問題にも出てくる語。読み直す語としては出すが、トピックを選ぶ材料にはしない
 * (Pod の出てくるトピックはどの問題でも同じになり、関係の薄いトピックが並ぶため)
 */
export const EVERYWHERE = new Set(['pod', 'node', 'kubectl', 'container-image', 'manifest', 'namespace', 'control-plane', 'kube-apiserver']);

/** 問題文・コード・選択肢・解説に出てくる用語集の語 (出てくる順、重なりなし) */
export function termsInQuestion(q: Question, names: { name: string; id: string }[], max = 6): string[] {
  const code = q.type === 'fill' ? q.code : q.code?.text;
  const texts = [q.prompt, ...(code ? [code] : []), ...(q.type === 'choice' ? q.choices.map((c) => c.text) : []), q.explanation];
  const ids: string[] = [];
  // 語ごとに最初の 1 回だけ拾う linker を、文をまたいで使い回す
  const link = makeTermLinker(names);
  for (const t of texts) for (const p of link(t)) if (typeof p !== 'string' && !ids.includes(p.id)) ids.push(p.id);
  return ids.slice(0, max);
}

/**
 * 読み直すトピック。点の高い順に max 個。
 * - そのレッスンを練習に持つトピック: +3
 * - 問題に出てくる語が出てくるトピック: 語ごとに +1 (どこにでも出る語は、問題と同じ分野のトピックにだけ +0.5)
 * - 問題の分野の範囲内のトピック: +2 (点が 1 以上のときだけ)。範囲外のトピック: -1
 * 同じ点ならハンドブックの並び (範囲内が先)
 */
export function topicsForQuestion(q: Question, termIds: string[], terms: Term[], topics: Topic[], domain?: string, max = 3): string[] {
  const lesson = lessonOfQuestion(q.id);
  const score = new Map<string, number>();
  const add = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n);
  if (lesson) for (const t of topics) if (t.lessons.includes(lesson)) add(t.id, 3);
  for (const id of termIds) {
    const term = terms.find((t) => t.id === id);
    if (!term) continue;
    // どこにでも出る語は、問題と同じ分野のトピックにだけ小さく効かせる (ほかの語が無い問題でも、分野の中から選べるように)
    const everywhere = EVERYWHERE.has(id);
    for (const t of topics) {
      if (everywhere && (!domain || t.domain !== domain)) continue;
      if (term.topics?.includes(t.id) || t.lessons.some((l) => term.lessons.includes(l))) add(t.id, everywhere ? 0.5 : 1);
    }
  }
  const order = new Map(topics.map((t, i) => [t.id, i]));
  return [...score]
    .map(([id, s]) => {
      const t = topics.find((x) => x.id === id)!;
      const appendix = t.domain.startsWith('付録');
      return { id, s: s + (domain && t.domain === domain ? 2 : 0) - (appendix ? 1 : 0) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || order.get(a.id)! - order.get(b.id)!)
    .slice(0, max)
    .map((x) => x.id);
}
