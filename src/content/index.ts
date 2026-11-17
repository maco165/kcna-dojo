import { WEEKS } from './curriculum';
import type { Lesson, Question } from './types';
import { dueReviewIds, type Progress } from '../lib/progress';

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

/** 今日の復習の問題。問題データから消えた id は飛ばす (件数のバッジもこれで数える) */
export function dueQuestions(p: Progress, now: Date): QuestionRef[] {
  return dueReviewIds(p, now)
    .map((id) => findQuestion(id))
    .filter((r): r is QuestionRef => r !== undefined);
}

export const isKnownQuestion = (id: string): boolean => findQuestion(id) !== undefined;
