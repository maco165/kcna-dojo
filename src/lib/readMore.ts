// 答えたあとの「読み直す」: その問題に関係するハンドブックのトピックと、問題に出てくる用語集の語を選ぶ
import type { Question } from '../content/types';
import { makeTermLinker } from './termLinks';

type Term = { id: string; lessons: string[]; topics?: string[] };
type Topic = { id: string; lessons: string[] };

/** 問題の id からレッスンの id (w1-l2-q4 → w1-l2)。模擬試験用の問題 (x-) はレッスンを持たない */
export const lessonOfQuestion = (id: string) => id.match(/^(w\d+-l\d+)-/)?.[1];

/** 問題文・コード・選択肢・解説に出てくる用語集の語 (出てくる順、重なりなし) */
export function termsInQuestion(q: Question, names: { name: string; id: string }[], max = 6): string[] {
  const texts = [q.prompt, ...(q.type === 'choice' ? q.choices.map((c) => c.text) : []), q.explanation];
  const ids: string[] = [];
  // 語ごとに最初の 1 回だけ拾う linker を、文をまたいで使い回す
  const link = makeTermLinker(names);
  for (const t of texts) for (const p of link(t)) if (typeof p !== 'string' && !ids.includes(p.id)) ids.push(p.id);
  return ids.slice(0, max);
}

/**
 * 読み直すトピック。レッスンの問題は、そのレッスンを練習に持つトピック。
 * 模擬試験用の問題は、問題に出てくる語の説明が挙げるトピックと、語が出てくるレッスンを持つトピック
 */
export function topicsForQuestion(q: Question, termIds: string[], terms: Term[], topics: Topic[], max = 3): string[] {
  const lesson = lessonOfQuestion(q.id);
  const direct = lesson ? topics.filter((t) => t.lessons.includes(lesson)).map((t) => t.id) : [];
  if (direct.length > 0) return direct.slice(0, max);
  const out: string[] = [];
  for (const id of termIds) {
    const term = terms.find((t) => t.id === id);
    if (!term) continue;
    const fromTerm = [...(term.topics ?? []), ...topics.filter((t) => t.lessons.some((l) => term.lessons.includes(l))).map((t) => t.id)];
    for (const t of fromTerm) if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, max);
}
