import { WEEKS } from './curriculum';
import type { Lesson } from './types';

export function findLesson(lessonId: string): { lesson: Lesson; week: number } | undefined {
  for (const w of WEEKS) {
    const lesson = w.content?.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, week: w.week };
  }
  return undefined;
}
