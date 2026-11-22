// 模擬試験用の問題 (レッスンに無い初見の問題)。正本は src/content/exam/*.json (週のファイルと同じ形で、week は 0)。
// 模擬試験と復習の画面を開いたときにだけ読む (最初に読む JS に入れない)
import type { QuestionRef } from './lessons';
import type { Lesson, Question } from './types';

type ExamFile = { week: 0; lessons: Lesson[] };
const FILES = import.meta.glob<ExamFile>('./exam/*.json', { eager: true, import: 'default' });

/** 模擬試験用の問題 (週は 0) */
export const EXAM_ONLY: (QuestionRef & { domain: Lesson['domain'] })[] = Object.keys(FILES)
  .sort()
  .flatMap((k) => FILES[k].lessons.flatMap((lesson) => (lesson.kind === 'quiz' ? lesson.questions.map((question: Question) => ({ question, lesson, week: 0, domain: lesson.domain })) : [])));

const BY_ID = new Map(EXAM_ONLY.map((r) => [r.question.id, r]));

/** 模擬試験用の問題を id で引く */
export const findExamQuestion = (id: string) => BY_ID.get(id);
