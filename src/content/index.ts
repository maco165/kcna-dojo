// 週の一覧・進み具合・題名に使う引き方。軽い形 (curriculum.ts の ?light) だけを読む。
// 問題の全文が要る引き方 (findQuestion・allQuestions・questionBank) は lessons.ts にある
import { WEEKS } from './curriculum';
import type { LessonMeta, QuestionMeta } from './types';
import { dueReviewIds, type Progress } from '../lib/progress';
import examSets from './examSets.json';

export function findLesson(lessonId: string): { lesson: LessonMeta; week: number } | undefined {
  for (const w of WEEKS) {
    const lesson = w.content?.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, week: w.week };
  }
  return undefined;
}

export type QuestionMetaRef = { question: QuestionMeta; lesson: LessonMeta; week: number };

/** 問題の id から、問題 (id・形・問題文) とそのレッスン・週を引く */
export function findQuestionMeta(questionId: string): QuestionMetaRef | undefined {
  for (const w of WEEKS) {
    for (const lesson of w.content?.lessons ?? []) {
      if (lesson.kind !== 'quiz') continue;
      const question = lesson.questions.find((q) => q.id === questionId);
      if (question) return { question, lesson, week: w.week };
    }
  }
  return undefined;
}

/**
 * 今日の復習の問題。問題データから消えた id は飛ばす。
 * 全文が要る画面 (復習) は find に lessons.ts の findQuestion などを渡す。
 * 模擬試験用の問題 (x- で始まる) は、それを読んだ画面 (復習) が find を渡したときだけ引ける
 */
export function dueQuestions(p: Progress, now: Date): QuestionMetaRef[];
export function dueQuestions<R>(p: Progress, now: Date, find: (id: string) => R | undefined): R[];
export function dueQuestions<R>(p: Progress, now: Date, find?: (id: string) => R | undefined): (R | QuestionMetaRef)[] {
  const f = find ?? findQuestionMeta;
  return dueReviewIds(p, now)
    .map((id) => f(id))
    .filter((r): r is R | QuestionMetaRef => r !== undefined);
}

/**
 * 模擬試験用の問題の id か (問題の本体を読まずに見分ける)。
 * 第 4・5 回 (examSets.json) が模擬試験用の問題を全部持つことは tests/examSets.test.ts が保証するので、その id で引く。
 * データから消えた x- の id は数えない (復習の画面で引けない問題をバッジに数えない)
 */
const EXAM_ONLY_IDS = new Set((examSets as { sets: { questions: string[] }[] }).sets.flatMap((s) => s.questions).filter((id) => id.startsWith('x-')));
export const isExamQuestionId = (id: string) => EXAM_ONLY_IDS.has(id);

/** 今日の復習の数 (タブのバッジ)。模擬試験用の問題も、データを読まずに数える */
export const dueReviewCount = (p: Progress, now: Date) => dueReviewIds(p, now).filter((id) => isExamQuestionId(id) || findQuestionMeta(id) !== undefined).length;

export const isKnownQuestion = (id: string): boolean => findQuestionMeta(id) !== undefined;
