// 進捗はブラウザの localStorage の 1 つのキーに JSON で置く。サーバーには送らない。
// 関数は保存先と今の時刻を引数で受け取り、テストで差し替えられるようにする。

export const STORAGE_KEY = 'kcna.v1';

export type LessonRecord = { done: boolean; best: number; at: string };
/**
 * 問題ごとの記録。復習の予定 (nextReview) があるものが復習の対象。
 * stage は復習で続けて正解した回数 (0〜2)。
 */
export type AnswerRecord = { right: number; wrong: number; last: string; stage?: number; nextReview?: string };

/** 復習の間隔 (日)。間違えたら翌日、復習で続けて正解するたびに 3 日後・7 日後、その次の正解で終わる */
export const REVIEW_INTERVALS = [1, 3, 7] as const;

/** 設定 (目標と受験日)。無ければ既定の値を使う */
export type Profile = { dailyGoalXp: number; examDate: string };

/** 1 日の目標の XP の既定と選べる値 */
export const DEFAULT_GOAL_XP = 30;
export const GOAL_CHOICES = [10, 20, 30, 50] as const;
/** 受験日の既定 (学習計画の「2027-03 上旬」) */
export const DEFAULT_EXAM_DATE = '2027-03-06';

export type Progress = {
  v: 1;
  profile?: Profile;
  streak: { count: number; lastDay: string | null };
  xp: { total: number; byDay: Record<string, number> };
  lessons: Record<string, LessonRecord>;
  answers: Record<string, AnswerRecord>;
};

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyProgress(): Progress {
  return { v: 1, streak: { count: 0, lastDay: null }, xp: { total: 0, byDay: {} }, lessons: {}, answers: {} };
}

/** 端末の時刻での日付 (YYYY-MM-DD) */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** 2 つの日付の差 (日)。to - from */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** JSON から読んだものを、欠けや形の違いを埋めた進捗にする。v が 1 でなければ null */
export function normalizeProgress(raw: unknown): Progress | null {
  if (!isObject(raw) || raw.v !== 1) return null;
  const base = emptyProgress();
  const streak = isObject(raw.streak) ? raw.streak : {};
  const xp = isObject(raw.xp) ? raw.xp : {};
  const profile = isObject(raw.profile) ? raw.profile : null;
  const out: Progress = {
    v: 1,
    streak: {
      count: typeof streak.count === 'number' ? streak.count : 0,
      lastDay: typeof streak.lastDay === 'string' ? streak.lastDay : null,
    },
    xp: {
      total: typeof xp.total === 'number' ? xp.total : 0,
      byDay: isObject(xp.byDay) ? (xp.byDay as Record<string, number>) : {},
    },
    lessons: isObject(raw.lessons) ? (raw.lessons as Record<string, LessonRecord>) : base.lessons,
    answers: isObject(raw.answers) ? (raw.answers as Record<string, AnswerRecord>) : base.answers,
  };
  if (profile) {
    out.profile = {
      dailyGoalXp: typeof profile.dailyGoalXp === 'number' && profile.dailyGoalXp > 0 ? profile.dailyGoalXp : DEFAULT_GOAL_XP,
      examDate: typeof profile.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(profile.examDate) ? profile.examDate : DEFAULT_EXAM_DATE,
    };
  }
  return out;
}

/** 書き出したファイルの中身を読む。読めない・形が違うときは null */
export function parseProgressText(text: string): Progress | null {
  try {
    return normalizeProgress(JSON.parse(text));
  } catch {
    return null;
  }
}

/** 読めない・形が違うときは初期値で始める (例外を外に出さない) */
export function loadProgress(storage: KeyValueStorage | undefined = safeLocalStorage()): Progress {
  if (!storage) return emptyProgress();
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyProgress();
  }
  if (!raw) return emptyProgress();
  return parseProgressText(raw) ?? emptyProgress();
}

export function saveProgress(p: Progress, storage: KeyValueStorage | undefined = safeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // 保存できない環境 (プライベートモードなど) では、その場限りの記録になる
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function recordAnswer(p: Progress, questionId: string, correct: boolean, now: Date): Progress {
  const today = dayKey(now);
  const prev = p.answers[questionId] ?? { right: 0, wrong: 0, last: '' };
  const next: AnswerRecord = {
    right: prev.right + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    last: now.toISOString(),
  };
  if (!correct) {
    // 間違えたら (初めてでも、復習の途中でも) 翌日からやり直す
    next.stage = 0;
    next.nextReview = addDays(today, REVIEW_INTERVALS[0]);
  } else if (prev.nextReview !== undefined) {
    // 復習の対象を正解した: 間を空ける。3 回続けて正解したら終わり
    const stage = (prev.stage ?? 0) + 1;
    if (stage < REVIEW_INTERVALS.length) {
      next.stage = stage;
      next.nextReview = addDays(today, REVIEW_INTERVALS[stage]);
    }
  }
  return { ...p, answers: { ...p.answers, [questionId]: next } };
}

/** 今日までに予定が来ている復習の問題の id (予定の早い順) */
export function dueReviewIds(p: Progress, now: Date): string[] {
  const today = dayKey(now);
  return Object.entries(p.answers)
    .filter(([, a]) => a.nextReview !== undefined && a.nextReview <= today)
    .sort(([, a], [, b]) => (a.nextReview! < b.nextReview! ? -1 : a.nextReview! > b.nextReview! ? 1 : 0))
    .map(([id]) => id);
}

/** まだ来ていない復習のうち、いちばん近い予定の日と件数 */
export function upcomingReview(p: Progress, now: Date): { day: string; count: number } | null {
  const today = dayKey(now);
  const days = Object.values(p.answers)
    .map((a) => a.nextReview)
    .filter((d): d is string => d !== undefined && d > today)
    .sort();
  if (days.length === 0) return null;
  return { day: days[0], count: days.filter((d) => d === days[0]).length };
}

/** 学んだ日の XP を足し、連続日数を進める (レッスンと復習で共通) */
function addActivity(p: Progress, xpGained: number, now: Date): Progress {
  const today = dayKey(now);
  let count: number;
  if (p.streak.lastDay === today) count = Math.max(p.streak.count, 1);
  else if (p.streak.lastDay === addDays(today, -1)) count = p.streak.count + 1;
  else count = 1;
  return {
    ...p,
    streak: { count, lastDay: today },
    xp: { total: p.xp.total + xpGained, byDay: { ...p.xp.byDay, [today]: (p.xp.byDay[today] ?? 0) + xpGained } },
  };
}

/** 今日の復習を終えた: XP を足し、連続日数を進める (レッスンの完了は付けない) */
export function completeReview(p: Progress, xpGained: number, now: Date): Progress {
  return addActivity(p, xpGained, now);
}

/** レッスンを終えた: 完了と最高の正答率を残し、XP を足し、連続日数を進める */
export function completeLesson(
  p: Progress,
  lessonId: string,
  score: { correct: number; total: number },
  xpGained: number,
  now: Date,
): Progress {
  const rate = score.total > 0 ? score.correct / score.total : 0;
  const prev = p.lessons[lessonId];
  const lesson: LessonRecord = { done: true, best: Math.max(prev?.best ?? 0, rate), at: now.toISOString() };
  const after = addActivity(p, xpGained, now);
  return { ...after, lessons: { ...after.lessons, [lessonId]: lesson } };
}

export function todayXp(p: Progress, now: Date): number {
  return p.xp.byDay[dayKey(now)] ?? 0;
}

/** 今日か昨日に学んでいれば続いている。2 日以上空いたら 0 */
export function currentStreak(p: Progress, now: Date): number {
  const today = dayKey(now);
  if (p.streak.lastDay === today || p.streak.lastDay === addDays(today, -1)) return p.streak.count;
  return 0;
}

export function goalXp(p: Progress): number {
  return p.profile?.dailyGoalXp ?? DEFAULT_GOAL_XP;
}

export function examDate(p: Progress): string {
  return p.profile?.examDate ?? DEFAULT_EXAM_DATE;
}

export function setProfile(p: Progress, change: Partial<Profile>): Progress {
  return { ...p, profile: { dailyGoalXp: goalXp(p), examDate: examDate(p), ...change } };
}

/** 記録を消す。目標と受験日の設定は残す */
export function resetProgress(p: Progress): Progress {
  const next = emptyProgress();
  if (p.profile) next.profile = { ...p.profile };
  return next;
}

/** 書き出すファイルの名前 (kcna-progress-YYYY-MM-DD.json) */
export function exportFileName(now: Date): string {
  return `kcna-progress-${dayKey(now)}.json`;
}
