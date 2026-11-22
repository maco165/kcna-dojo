// 問題ごとの到達 (まだ・間違えた・1 回正解・2 回続けて正解) を、学習要領の 4 分野ごとに数える。進捗の画面を開いたときにだけ読む。
// 問題はレッスンの問題 (週のファイル) と模擬試験用の初見の問題 (exam/*.json)。どちらも ?light の軽い形 (id と分野) で読む
import { WEEKS } from '../content/curriculum';
import type { Domain, WeekIndex } from '../content/types';
import { DOMAINS } from './lessonStatus';
import { masteryOf, type Mastery, type Progress } from './progress';

const EXAM_FILES = import.meta.glob<WeekIndex>('../content/exam/*.json', { eager: true, import: 'default', query: '?light' });

export type QuestionDomain = { id: string; domain: Domain };

/** 数える問題: レッスンの問題と模擬試験用の問題 (実習は入れない) */
export function allQuestionDomains(): QuestionDomain[] {
  const fromLessons = (lessons: WeekIndex['lessons']) => lessons.flatMap((l) => (l.kind === 'quiz' ? l.questions.map((q) => ({ id: q.id, domain: l.domain })) : []));
  return [...WEEKS.flatMap((w) => fromLessons(w.content?.lessons ?? [])), ...Object.keys(EXAM_FILES).sort().flatMap((k) => fromLessons(EXAM_FILES[k].lessons))];
}

export const MASTERY_ORDER: Mastery[] = ['twice', 'once', 'wrong', 'new'];
export const MASTERY_LABEL: Record<Mastery, string> = { twice: '2 回続けて正解', once: '1 回正解', wrong: '間違えた (直近)', new: 'まだ解いていない' };

export type DomainMastery = { domain: Domain; short: string; total: number; counts: Record<Mastery, number> };

/** 分野ごとの到達の数 (学習要領の 4 分野の順) */
export function masteryByDomain(p: Progress, questions: QuestionDomain[] = allQuestionDomains()): DomainMastery[] {
  return DOMAINS.map((d) => {
    const counts: Record<Mastery, number> = { twice: 0, once: 0, wrong: 0, new: 0 };
    const qs = questions.filter((q) => q.domain === d.name);
    for (const q of qs) counts[masteryOf(p.answers[q.id])]++;
    return { domain: d.name, short: d.short, total: qs.length, counts };
  });
}

/** 割合 (%) を四捨五入 */
export const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
