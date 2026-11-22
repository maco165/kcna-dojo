import { WEEKS } from '../content/curriculum';
import type { Domain, LessonMeta as Lesson } from '../content/types';
import { addDays, dayKey, planStart, weekStartDay, type Progress } from './progress';

export type LessonStatus = 'done' | 'next' | 'pending';

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
    for (const l of w.content?.lessons ?? []) {
      if (l.kind !== 'quiz') continue;
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
 * 実習はクラスタが無いと進められないので、遅れには数えず labsLeft (残っている実習の数) に分ける。
 * expected が 0 なら、まだ計画の週が終わっていない
 */
export function planStatus(progress: Progress, now: Date): { expected: number; done: number; labsLeft: number } {
  const today = dayKey(now);
  const start = planStart(progress, now);
  let expected = 0;
  let done = 0;
  let labsLeft = 0;
  for (const w of WEEKS) {
    const end = addDays(weekStartDay(start, w.week), 6);
    if (end >= today) continue;
    for (const l of w.content?.lessons ?? []) {
      const isDone = progress.lessons[l.id]?.done === true;
      if (l.kind === 'lab') {
        if (!isDone) labsLeft++;
        continue;
      }
      expected++;
      if (isDone) done++;
    }
  }
  return { expected, done, labsLeft };
}
