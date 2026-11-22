// 問題の全文 (選択肢・正解・解説・出典まで)。レッスン・復習・模擬試験・説明のページなど、開いたときに読む画面だけが取り込む
// (ホームと本体は curriculum.ts の軽い形を使い、最初に読む JS に全文を入れない。scripts/e2e.mjs の checkFirstLoad が見張る)
import type { Lesson, Question, WeekContent } from './types';

const FILES = import.meta.glob<WeekContent>('./week*.json', { eager: true, import: 'default' });

/** 週ごとの問題の全文 (週の順) */
export const WEEK_CONTENTS: WeekContent[] = Object.values(FILES).sort((a, b) => a.week - b.week);

export type QuestionRef = { question: Question; lesson: Lesson; week: number };

/** レッスンの全文と週 */
export function findLessonContent(lessonId: string): { lesson: Lesson; week: number } | undefined {
  for (const w of WEEK_CONTENTS) {
    const lesson = w.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, week: w.week };
  }
  return undefined;
}

/** 問題の id から、問題とそのレッスン・週を引く (復習で使う) */
export function findQuestion(questionId: string): QuestionRef | undefined {
  for (const w of WEEK_CONTENTS) {
    for (const lesson of w.lessons) {
      if (lesson.kind !== 'quiz') continue;
      const question = lesson.questions.find((q) => q.id === questionId);
      if (question) return { question, lesson, week: w.week };
    }
  }
  return undefined;
}

/** すべての週の 4 択と穴埋め (ランダム出題で使う) */
export function allQuestions(): (QuestionRef & { domain: Lesson['domain'] })[] {
  return WEEK_CONTENTS.flatMap((w) => w.lessons.flatMap((lesson) => (lesson.kind === 'quiz' ? lesson.questions.map((question) => ({ question, lesson, week: w.week, domain: lesson.domain })) : [])));
}

/** 模擬試験の問題の束: すべての週の 4 択と穴埋め (分野つき) */
export function questionBank(): { question: Question; domain: Lesson['domain'] }[] {
  return allQuestions().map(({ question, domain }) => ({ question, domain }));
}
