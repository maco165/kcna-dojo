// 進捗はブラウザの localStorage の 1 つのキーに JSON で置く。サーバーには送らない。
// 関数は保存先と今の時刻を引数で受け取り、テストで差し替えられるようにする。

export const STORAGE_KEY = 'kcna.v1';

export type LessonRecord = { done: boolean; best: number; at: string };
/**
 * 問題ごとの記録。復習の予定 (nextReview) があるものが復習の対象。
 * stage は復習で続けて正解した回数 (0〜2)。
 */
export type AnswerRecord = { right: number; wrong: number; last: string; stage?: number; nextReview?: string };

/** 問題ごとの記録を 1 行の文にする (例: これまで 3 回 (正解 2・不正解 1) · 最後 11/18)。記録が無ければ「はじめて」 */
export function answerHistory(rec: AnswerRecord | undefined): string {
  const n = rec ? rec.right + rec.wrong : 0;
  if (!rec || n === 0) return 'はじめて';
  const d = new Date(rec.last);
  const last = Number.isNaN(d.getTime()) ? '' : ` · 最後 ${d.getMonth() + 1}/${d.getDate()}`;
  return `これまで ${n} 回 (正解 ${rec.right}・不正解 ${rec.wrong})${last}`;
}

/** 復習の間隔 (日)。間違えたら翌日、復習で続けて正解するたびに 3 日後・7 日後、その次の正解で終わる */
export const REVIEW_INTERVALS = [1, 3, 7] as const;

/** 画面の色。system は端末の設定に合わせる */
export type ColorMode = 'system' | 'light' | 'dark';
export const COLOR_MODES: readonly ColorMode[] = ['system', 'light', 'dark'];
/**
 * 設定 (目標・受験日・学習の開始日・画面の色)。目標は無ければ既定の値を使う。
 * 受験日 (examDate) は利用者が決めるまで持たない (決めていない人に試験までの日数を出さない)。
 * 学習の開始日 (startDate) は週の日付を数える起点で、決めていなければ初めて学んだ日 (planStart)
 */
export type Profile = { dailyGoalXp: number; examDate?: string; startDate?: string; colorMode?: ColorMode };

/** 1 日の目標の XP の既定と選べる値 */
export const DEFAULT_GOAL_XP = 30;
export const GOAL_CHOICES = [10, 20, 30, 50] as const;

/** 模擬試験の結果 (新しい順に最大 20 件) */
/** set は決まった回 (第 n 回) の番号。ランダムに選んだ回には付けない */
export type ExamRecord = { at: string; correct: number; total: number; set?: number };
export const MAX_EXAM_RECORDS = 20;

/** ハンドブックのトピックごとの読んだ記録。seen は「全体の流れ」の何段目までを画面に出したか、done は確認済み */
export type HandbookRecord = { seen: number; done?: boolean; at: string };

export type Progress = {
  v: 1;
  handbook?: Record<string, HandbookRecord>;
  profile?: Profile;
  exams?: ExamRecord[];
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

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 実在する日付 (YYYY-MM-DD) か。2027-02-31 のようなものは偽 */
export function isValidDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d)) === v;
}

/** 値を 1 つずつ確かめ、形の合うものだけ残す (読み込んだファイルや壊れた localStorage で画面が落ちないように) */
function cleanRecords<T>(raw: unknown, clean: (v: Record<string, unknown>) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    const c = clean(value);
    if (c !== null) out[key] = c;
  }
  return out;
}

/** JSON から読んだものを、欠けや形の違いを埋めた進捗にする。v が 1 でなければ null */
export function normalizeProgress(raw: unknown): Progress | null {
  if (!isObject(raw) || raw.v !== 1) return null;
  const streak = isObject(raw.streak) ? raw.streak : {};
  const xp = isObject(raw.xp) ? raw.xp : {};
  const profile = isObject(raw.profile) ? raw.profile : null;
  const byDay: Record<string, number> = {};
  if (isObject(xp.byDay)) {
    for (const [day, v] of Object.entries(xp.byDay)) if (isValidDay(day) && isCount(v)) byDay[day] = v;
  }
  const out: Progress = {
    v: 1,
    streak: {
      count: isCount(streak.count) ? Math.floor(streak.count) : 0,
      lastDay: isValidDay(streak.lastDay) ? streak.lastDay : null,
    },
    xp: { total: isCount(xp.total) ? xp.total : 0, byDay },
    lessons: cleanRecords(raw.lessons, (v) =>
      v.done === true ? { done: true, best: isCount(v.best) ? Math.min(v.best, 1) : 0, at: typeof v.at === 'string' ? v.at : '' } : null,
    ),
    answers: cleanRecords(raw.answers, (v) => {
      const a: AnswerRecord = {
        right: isCount(v.right) ? Math.floor(v.right) : 0,
        wrong: isCount(v.wrong) ? Math.floor(v.wrong) : 0,
        last: typeof v.last === 'string' ? v.last : '',
      };
      if (isValidDay(v.nextReview)) {
        a.nextReview = v.nextReview;
        a.stage = isCount(v.stage) ? Math.min(Math.floor(v.stage), REVIEW_INTERVALS.length - 1) : 0;
      }
      return a;
    }),
  };
  if (Array.isArray(raw.exams)) {
    out.exams = raw.exams
      .filter((e): e is Record<string, unknown> => isObject(e) && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) && isCount(e.correct) && isCount(e.total) && (e.total as number) > 0 && (e.correct as number) <= (e.total as number))
      .map((e) => ({ at: e.at as string, correct: e.correct as number, total: e.total as number, ...(Number.isInteger(e.set) && (e.set as number) >= 1 ? { set: e.set as number } : {}) }));
    out.exams = trimExamRecords(out.exams);
  }
  const handbook = cleanRecords(raw.handbook, (v) =>
    isCount(v.seen) || v.done === true ? { seen: isCount(v.seen) ? Math.floor(v.seen) : 0, ...(v.done === true ? { done: true } : {}), at: typeof v.at === 'string' ? v.at : '' } : null,
  );
  for (const k of Object.keys(handbook)) if (!/^[a-z0-9-]+$/.test(k)) delete handbook[k];
  if (Object.keys(handbook).length > 0) out.handbook = handbook;
  if (profile) {
    out.profile = {
      dailyGoalXp: (GOAL_CHOICES as readonly number[]).includes(profile.dailyGoalXp as number) ? (profile.dailyGoalXp as number) : DEFAULT_GOAL_XP,
    };
    // 受験日と開始日は、実在する日付のときだけ残す (前の版が書いた受験日もそのまま読む)
    if (isValidDay(profile.examDate)) out.profile.examDate = profile.examDate;
    if (isValidDay(profile.startDate)) out.profile.startDate = profile.startDate;
    if ((COLOR_MODES as readonly unknown[]).includes(profile.colorMode) && profile.colorMode !== 'system') out.profile.colorMode = profile.colorMode as ColorMode;
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

/** 保存できたら true。保存できない環境 (プライベートモード・容量の上限など) では false で、その場限りの記録になる */
export function saveProgress(p: Progress, storage: KeyValueStorage | undefined = safeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
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
  } else if (prev.nextReview !== undefined && prev.nextReview <= today) {
    // 予定の日が来た復習の対象を正解した: 間を空ける。3 回続けて正解したら終わり
    const stage = (prev.stage ?? 0) + 1;
    if (stage < REVIEW_INTERVALS.length) {
      next.stage = stage;
      next.nextReview = addDays(today, REVIEW_INTERVALS[stage]);
    }
  } else if (prev.nextReview !== undefined) {
    // 予定の日より前に (レッスンのやり直しなどで) 正解しても、予定は進めずそのまま残す
    next.stage = prev.stage ?? 0;
    next.nextReview = prev.nextReview;
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

/** まだ来ていない復習のうち、いちばん近い予定の日と件数。isKnown で問題データにある id だけに絞れる */
export function upcomingReview(p: Progress, now: Date, isKnown: (id: string) => boolean = () => true): { day: string; count: number } | null {
  const today = dayKey(now);
  const days = Object.entries(p.answers)
    .filter(([id]) => isKnown(id))
    .map(([, a]) => a.nextReview)
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

/** 受験日。決めていなければ undefined (試験までの日数を出さず、決める画面へ案内する) */
export function examDate(p: Progress): string | undefined {
  return p.profile?.examDate;
}

/** 試験までの日数。受験日を決めていなければ null */
export function daysToExam(p: Progress, now: Date): number | null {
  const d = examDate(p);
  return d ? daysBetween(dayKey(now), d) : null;
}

/** 初めて学んだ日 (XP・レッスン・答え・模擬試験・ハンドブックの記録のいちばん古い日)。記録が無ければ null */
export function firstStudyDay(p: Progress): string | null {
  const days: string[] = Object.keys(p.xp.byDay);
  const fromIso = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) days.push(dayKey(new Date(t)));
  };
  for (const l of Object.values(p.lessons)) fromIso(l.at);
  for (const a of Object.values(p.answers)) fromIso(a.last);
  for (const e of p.exams ?? []) fromIso(e.at);
  for (const h of Object.values(p.handbook ?? {})) fromIso(h.at);
  return days.length > 0 ? days.sort()[0] : null;
}

/** 週の日付を数える起点: 設定で決めた開始日、無ければ初めて学んだ日、まだ学んでいなければ今日 */
export function planStart(p: Progress, now: Date): string {
  return p.profile?.startDate ?? firstStudyDay(p) ?? dayKey(now);
}

/** 第 week 週の始まりの日 (起点から 7 日ずつ) */
export function weekStartDay(start: string, week: number): string {
  return addDays(start, (week - 1) * 7);
}

export function colorMode(p: Progress): ColorMode {
  return p.profile?.colorMode ?? 'system';
}

export function setProfile(p: Progress, change: Partial<Profile>): Progress {
  const next: Profile = { ...p.profile, dailyGoalXp: goalXp(p), ...change };
  // 既定 (端末に合わせる) と、消した受験日・開始日は持たない
  if (next.colorMode === 'system') delete next.colorMode;
  if (!next.examDate) delete next.examDate;
  if (!next.startDate) delete next.startDate;
  return { ...p, profile: next };
}

/** ハンドブックのトピックを n 段目まで読んだ (前より進んだときだけ書き換える) */
export function markHandbookSeen(p: Progress, topicId: string, seen: number, now: Date): Progress {
  const cur = p.handbook?.[topicId];
  if (cur && cur.seen >= seen) return p;
  return { ...p, handbook: { ...p.handbook, [topicId]: { ...cur, seen, at: now.toISOString() } } };
}

/** ハンドブックのトピックを確認済みにする・外す */
export function setHandbookDone(p: Progress, topicId: string, done: boolean, now: Date): Progress {
  const cur = p.handbook?.[topicId] ?? { seen: 0, at: '' };
  const next: HandbookRecord = { seen: cur.seen, at: now.toISOString() };
  if (done) next.done = true;
  return { ...p, handbook: { ...p.handbook, [topicId]: next } };
}

/** 記録を消す。目標・受験日・開始日・画面の色の設定は残す */
export function resetProgress(p: Progress): Progress {
  const next = emptyProgress();
  if (p.profile) next.profile = { ...p.profile };
  return next;
}

/** 書き出すファイルの名前 (kcna-progress-YYYY-MM-DD.json) */
export function exportFileName(now: Date): string {
  return `kcna-progress-${dayKey(now)}.json`;
}

/**
 * 新しい順の記録を上限の件数に切る。ただし決まった回 (set) ごとのいちばん新しい記録は、
 * 上限より古くても 1 件ずつ残す (「前回の結果」が押し出されて消えないように)
 */
export function trimExamRecords(records: ExamRecord[]): ExamRecord[] {
  const kept = records.slice(0, MAX_EXAM_RECORDS);
  const sets = new Set(kept.map((e) => e.set).filter((n) => n !== undefined));
  for (const e of records.slice(MAX_EXAM_RECORDS)) {
    if (e.set === undefined || sets.has(e.set)) continue;
    sets.add(e.set);
    kept.push(e);
  }
  return kept;
}

/** 模擬試験の結果を残す (新しいものを先頭に、最大 20 件と、回ごとの最新) */
export function addExamRecord(p: Progress, record: ExamRecord): Progress {
  return { ...p, exams: trimExamRecords([record, ...(p.exams ?? [])]) };
}
