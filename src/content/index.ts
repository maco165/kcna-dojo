import { WEEKS } from './curriculum';
import type { Lesson, Question } from './types';
import { dueReviewIds, type Progress } from '../lib/progress';
import examSets from './examSets.json';

export function findLesson(lessonId: string): { lesson: Lesson; week: number } | undefined {
  for (const w of WEEKS) {
    const lesson = w.content?.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, week: w.week };
  }
  return undefined;
}

export type QuestionRef = { question: Question; lesson: Lesson; week: number };

/** 問題の id から、問題とそのレッスン・週を引く (復習で使う) */
export function findQuestion(questionId: string): QuestionRef | undefined {
  for (const w of WEEKS) {
    for (const lesson of w.content?.lessons ?? []) {
      if (lesson.kind !== 'quiz') continue;
      const question = lesson.questions.find((q) => q.id === questionId);
      if (question) return { question, lesson, week: w.week };
    }
  }
  return undefined;
}

/** すべての週の 4 択と穴埋め (ランダム出題で使う) */
export function allQuestions(): (QuestionRef & { domain: Lesson['domain'] })[] {
  return WEEKS.flatMap((w) =>
    (w.content?.lessons ?? []).flatMap((lesson) => (lesson.kind === 'quiz' ? lesson.questions.map((question) => ({ question, lesson, week: w.week, domain: lesson.domain })) : [])),
  );
}

/**
 * 今日の復習の問題。問題データから消えた id は飛ばす。
 * 模擬試験用の問題 (x- で始まる) は、それを読んだ画面 (復習) が find を渡したときだけ引ける
 */
export function dueQuestions(p: Progress, now: Date, find: (id: string) => QuestionRef | undefined = findQuestion): QuestionRef[] {
  return dueReviewIds(p, now)
    .map((id) => find(id))
    .filter((r): r is QuestionRef => r !== undefined);
}

/**
 * 模擬試験用の問題の id か (問題の本体を読まずに見分ける)。
 * 第 4・5 回 (examSets.json) が模擬試験用の問題を全部持つことは tests/examSets.test.ts が保証するので、その id で引く。
 * データから消えた x- の id は数えない (復習の画面で引けない問題をバッジに数えない)
 */
const EXAM_ONLY_IDS = new Set((examSets as { sets: { questions: string[] }[] }).sets.flatMap((s) => s.questions).filter((id) => id.startsWith('x-')));
export const isExamQuestionId = (id: string) => EXAM_ONLY_IDS.has(id);

/** 今日の復習の数 (タブのバッジ)。模擬試験用の問題も、データを読まずに数える */
export const dueReviewCount = (p: Progress, now: Date) => dueReviewIds(p, now).filter((id) => isExamQuestionId(id) || findQuestion(id) !== undefined).length;

export const isKnownQuestion = (id: string): boolean => findQuestion(id) !== undefined;

/** 模擬試験の問題の束: すべての週の 4 択と穴埋め (分野つき) */
export function questionBank(): { question: Question; domain: Lesson['domain'] }[] {
  const out: { question: Question; domain: Lesson['domain'] }[] = [];
  for (const w of WEEKS) {
    for (const lesson of w.content?.lessons ?? []) {
      if (lesson.kind !== 'quiz') continue;
      for (const question of lesson.questions) out.push({ question, domain: lesson.domain });
    }
  }
  return out;
}
