// 受験の目安: 学習要領の 13 細目ごとの到達と、模擬試験の直近の結果から、受験してよいかの目安を出す。進捗の画面を開いたときにだけ読む。
// 合格を保証するものではない。数字の決め方と理由は docs/design.md の「受験の目安」
import { CURRICULUM } from '../content/guide';
import type { Domain } from '../content/types';
import examSets from '../content/examSets.json';
import { PASS_MARK } from './exam';
import { masteryOf, type ExamRecord, type Progress } from './progress';

/** 週の問題のファイルの id と分野・細目だけの形 (vite.config.ts の ?ids)。問題の本文は読まない */
type IdsFile = { week: number; lessons: { id: string; kind: string; domain: Domain; competency?: string; ids: string[] }[] };
const WEEK_FILES = import.meta.glob<IdsFile>('../content/week*.json', { eager: true, import: 'default', query: '?ids' });

/** 細目ごとに数える問題: その細目を持つレッスンの問題 (模擬試験用の初見の問題は細目を持たないので、模擬試験の結果の側で見る) */
export type CompetencyLessons = { en: string; lessons: { id: string; questions: string[] }[] };

export function competencyLessons(files: IdsFile[] = Object.values(WEEK_FILES)): CompetencyLessons[] {
  const all = files.flatMap((f) => f.lessons);
  return CURRICULUM.flatMap((c) => c.competencies).map((c) => ({
    en: c.en,
    lessons: all.filter((l) => l.kind === 'quiz' && l.competency === c.en).map((l) => ({ id: l.id, questions: l.ids })),
  }));
}

/**
 * 細目ごとに「2 回続けて正解」が占める割合の目安。合格の目安 (PASS_MARK の 75%) と同じ数字にする。
 * 公式に細目ごとの合格点は無いので、これより強い根拠のある数字は持たない
 */
export const COMPETENCY_TARGET = PASS_MARK;
/** 模擬試験は、直近のこの回数がどれも合格の目安以上であること (1 回だけの当たり外れで決めない) */
export const RECENT_EXAMS = 2;

/** 初見の問題だけの決まった回 (第 4・5 回)。レッスンで見た問題を覚えて解ける回 (第 1〜3 回とランダム) と分ける */
export const FRESH_SETS: number[] = (examSets as { sets: { id: number; questions: string[] }[] }).sets.filter((s) => s.questions.every((id) => id.startsWith('x-'))).map((s) => s.id);

export type CompetencyReadiness = { en: string; ja: string; domain: Domain; topic: string; total: number; twice: number; rate: number; ok: boolean; lessons: string[] };
export type ExamReadiness = { recent: (ExamRecord & { rate: number; fresh: boolean; ok: boolean })[]; ok: boolean; hasFresh: boolean };
export type Readiness = { ready: boolean; competencies: CompetencyReadiness[]; short: CompetencyReadiness[]; exam: ExamReadiness };

/**
 * 受験の目安。次の 3 つがそろえば ready:
 * 1. 13 細目のどれも、その細目のレッスンの問題のうち「2 回続けて正解」が COMPETENCY_TARGET 以上
 * 2. 模擬試験の直近 RECENT_EXAMS 回が、どれも合格の目安 (PASS_MARK) 以上
 * 3. その中に初見の問題だけの回 (FRESH_SETS) が 1 回以上ある (覚えた問題だけで目安を越えたとしない)
 */
export function readiness(p: Progress, lessons: CompetencyLessons[] = competencyLessons()): Readiness {
  const meta = CURRICULUM.flatMap((c) => c.competencies.map((x) => ({ ...x, domain: c.domain })));
  const competencies = meta.map((m) => {
    const ls = lessons.find((l) => l.en === m.en)?.lessons ?? [];
    const qs = ls.flatMap((l) => l.questions);
    const twice = qs.filter((id) => masteryOf(p.answers[id]) === 'twice').length;
    const rate = qs.length > 0 ? twice / qs.length : 0;
    return { en: m.en, ja: m.ja, domain: m.domain, topic: m.topic, total: qs.length, twice, rate, ok: qs.length > 0 && rate >= COMPETENCY_TARGET, lessons: ls.map((l) => l.id) };
  });
  const recent = (p.exams ?? []).slice(0, RECENT_EXAMS).map((e) => {
    const rate = e.total > 0 ? e.correct / e.total : 0;
    return { ...e, rate, fresh: e.set !== undefined && FRESH_SETS.includes(e.set), ok: rate >= PASS_MARK };
  });
  const hasFresh = recent.some((e) => e.fresh);
  const examOk = recent.length === RECENT_EXAMS && recent.every((e) => e.ok) && hasFresh;
  const short = competencies.filter((c) => !c.ok);
  return { ready: short.length === 0 && examOk, competencies, short, exam: { recent, ok: examOk, hasFresh } };
}
