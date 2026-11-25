import { WEEKS } from '../content/curriculum';
import type { Domain, LabLesson, LessonMeta as Lesson, QuizLessonMeta, WeekIndex } from '../content/types';
import { addDays, dayKey, planStart, weekStartDay, type Progress } from './progress';

export type LessonStatus = 'done' | 'next' | 'pending';

/** 週の問題演習 (実習を除いたレッスン)。週の画面・左の一覧・進捗・「次」・書き出す HTML の週のページが数えるのは、これだけ */
export const exercisesOf = (week: { content?: WeekIndex }): QuizLessonMeta[] => (week.content?.lessons ?? []).filter((l) => l.kind === 'quiz');

/** 週の実習 (実践の一覧に並べる) */
export const labsOf = (week: { content?: WeekIndex }): LabLesson[] => (week.content?.lessons ?? []).filter((l) => l.kind === 'lab');

/** 終えたレッスンの数 */
export const doneLessons = (lessons: { id: string }[], progress: Progress) => lessons.filter((l) => progress.lessons[l.id]?.done).length;

/** まだ終えていない最初のレッスンだけが「次」 */
export function lessonStatuses(lessons: Lesson[], progress: Progress): LessonStatus[] {
  let nextGiven = false;
  return lessons.map((l) => {
    if (progress.lessons[l.id]?.done) return 'done';
    if (!nextGiven) {
      nextGiven = true;
      return 'next';
    }
    return 'pending';
  });
}

/** 一覧の小見出し: "l3 · コマンドの穴埋めと 4 択 · 5 問" */
export function lessonCaption(l: Lesson): string {
  const short = l.id.replace(/^w\d+-/, '');
  return `${short} · ${l.summary}`;
}

/** 問題の形の列: "4 択" / "コマンドの穴埋め" など。summary の「 · 」の前 */
export function lessonFormat(l: Lesson): string {
  return l.summary.split(' · ')[0];
}

export function lessonCount(l: Lesson): number {
  return l.kind === 'quiz' ? l.questions.length : l.steps.length;
}

/** 「最高の正答」の列: これまでの回でいちばん良かった正答率を、問題の数に掛けて「n / 問題数」にする。終えていなければ — */
export function lessonCorrect(l: Lesson, progress: Progress): string {
  if (l.kind !== 'quiz') return progress.lessons[l.id]?.done ? `${l.steps.length} / ${l.steps.length}` : '—';
  const rec = progress.lessons[l.id];
  if (!rec?.done) return '—';
  return `${Math.round(rec.best * l.questions.length)} / ${l.questions.length}`;
}

export const DOMAINS: { name: Domain; short: string; weight: number }[] = [
  { name: 'Kubernetes Fundamentals', short: 'Fundamentals', weight: 44 },
  { name: 'Container Orchestration', short: 'Orchestration', weight: 28 },
  { name: 'Cloud Native Application Delivery', short: 'App Delivery', weight: 16 },
  { name: 'Cloud Native Architecture', short: 'Architecture', weight: 12 },
];

/** 分野ごとの正答率 (答えた回数の合計に対する正解の割合)。答えていなければ null */
export function domainAccuracy(progress: Progress): Record<Domain, number | null> {
  const sum = new Map<Domain, { right: number; total: number }>();
  for (const w of WEEKS) {
    for (const l of exercisesOf(w)) {
      for (const q of l.questions) {
        const a = progress.answers[q.id];
        if (!a) continue;
        const s = sum.get(l.domain) ?? { right: 0, total: 0 };
        s.right += a.right;
        s.total += a.right + a.wrong;
        sum.set(l.domain, s);
      }
    }
  }
  const out = {} as Record<Domain, number | null>;
  for (const d of DOMAINS) {
    const s = sum.get(d.name);
    out[d.name] = s && s.total > 0 ? s.right / s.total : null;
  }
  return out;
}

/** この 7 日 (今日を含む) の日ごとの XP。古い順 */
export function weeklyXp(progress: Progress, now: Date): { day: string; xp: number }[] {
  const out: { day: string; xp: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    out.push({ day, xp: progress.xp.byDay[day] ?? 0 });
  }
  return out;
}

/**
 * 計画との差。終わっているはずの週 (利用者の開始日から数えた週の 7 日目が昨日まで) の問題のレッスンの数と、そのうち終えた数。
 * 実習は実践のページで別に数えるので、入れない。
 * expected が 0 なら、まだ計画の週が終わっていない
 */
export function planStatus(progress: Progress, now: Date): { expected: number; done: number } {
  const today = dayKey(now);
  const start = planStart(progress, now);
  let expected = 0;
  let done = 0;
  for (const w of WEEKS) {
    const end = addDays(weekStartDay(start, w.week), 6);
    if (end >= today) continue;
    const lessons = exercisesOf(w);
    expected += lessons.length;
    done += doneLessons(lessons, progress);
  }
  return { expected, done };
}
