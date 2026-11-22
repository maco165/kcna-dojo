// レッスンの画面。問題の全文 (content/lessons.ts) と一緒に、レッスンを開いたときに読む (最初に読む JS を軽くするため)
import type { ComponentProps } from 'react';
import { findLessonContent } from '../content/lessons';
import LessonScreen from './LessonScreen';

type Props = Omit<ComponentProps<typeof LessonScreen>, 'lesson' | 'week'> & { lessonId: string };

export default function LessonRoute({ lessonId, ...rest }: Props) {
  const found = findLessonContent(lessonId);
  if (!found) return null;
  return <LessonScreen key={found.lesson.id} lesson={found.lesson} week={found.week} {...rest} />;
}
