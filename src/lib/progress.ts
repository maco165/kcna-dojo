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

/**
 * 連続日数。freezes は休みの札の数 (0〜MAX_FREEZES)、toNext は次の札まで学んだ日の数 (0〜6)、
 * used は札を使った日 (古い順に最大 MAX_USED 件)。札の欄が無い前の版の記録は 0 個から数える
 */
export type Streak = { count: number; lastDay: string | null; freezes?: number; toNext?: number; used?: string[] };

/** 休みの札の上限と、1 個たまるまでに学ぶ日の数 */
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
/** 札を使った日を残す数 */
export const MAX_USED = 14;

export type Progress = {
  v: 1;
  handbook?: Record<string, HandbookRecord>;
  profile?: Profile;
  exams?: ExamRecord[];
  streak: Streak;
  xp: { total: number; byDay: Record<string, number> };
  lessons: Record<string, LessonRecord>;
  answers: Record<string, AnswerRecord>;
  /** 日ごとの答えた問題の数 (レッスン・復習・模擬試験)。前の版の記録には無い */
  solved?: Record<string, number>;
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
  if (isObject(raw.solved)) {
    const solved: Record<string, number> = {};
    for (const [day, v] of Object.entries(raw.solved)) if (isValidDay(day) && isCount(v) && v >= 1) solved[day] = Math.floor(v);
    if (Object.keys(solved).length > 0) out.solved = solved;
  }
  // 休みの札 (前の版の記録には無い。無ければ書かない)
  if (isCount(streak.freezes) && streak.freezes >= 1) out.streak.freezes = Math.min(Math.floor(streak.freezes), MAX_FREEZES);
  if (isCount(streak.toNext) && streak.toNext >= 1) out.streak.toNext = Math.min(Math.floor(streak.toNext), FREEZE_EVERY - 1);
  if (Array.isArray(streak.used)) {
    const used = [...new Set(streak.used.filter(isValidDay))].sort().slice(-MAX_USED);
    if (used.length > 0) out.streak.used = used;
  }
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
  return { ...p, answers: { ...p.answers, [questionId]: next }, solved: { ...p.solved, [today]: (p.solved?.[today] ?? 0) + 1 } };
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

/** 前に学んだ日と今日の間で、学ばなかった日の数 (前に学んでいない・日付が戻ったときは null) */
function missedDays(lastDay: string | null, today: string): number | null {
  if (!lastDay) return null;
  const gap = daysBetween(lastDay, today) - 1;
  return gap >= 0 ? gap : null;
}

/**
 * 今日学んだときの連続日数と休みの札。順番は「使う → たまる」:
 * 1. 学ばなかった日があり、その日数ぶんの札があれば、札を使って連続を保つ (今日の分の 1 だけ増える。休んだ日は数えない)。
 *    足りなければ札は使わずに 1 から数え直す
 * 2. 今日が新しく学んだ日なら、次の札までの日を 1 進め、7 日で札を 1 個足す (上限 2 個。上限でも日は数え、7 日で 0 に戻す)
 */
export function advanceStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return { ...s, count: Math.max(s.count, 1) };
  let freezes = s.freezes ?? 0;
  let used = s.used ?? [];
  let count: number;
  const missed = missedDays(s.lastDay, today);
  if (missed === 0) count = s.count + 1;
  else if (missed !== null && s.count > 0 && missed <= freezes) {
    freezes -= missed;
    used = [...used, ...Array.from({ length: missed }, (_, i) => addDays(s.lastDay!, i + 1))].slice(-MAX_USED);
    count = s.count + 1;
  } else count = 1;
  let toNext = (s.toNext ?? 0) + 1;
  if (toNext >= FREEZE_EVERY) {
    toNext = 0;
    freezes = Math.min(MAX_FREEZES, freezes + 1);
  }
  const out: Streak = { count, lastDay: today };
  if (freezes > 0) out.freezes = freezes;
  if (toNext > 0) out.toNext = toNext;
  if (used.length > 0) out.used = used;
  return out;
}

/** 学んだ日の XP を足し、連続日数を進める (レッスンと復習で共通) */
function addActivity(p: Progress, xpGained: number, now: Date): Progress {
  const today = dayKey(now);
  return {
    ...p,
    streak: advanceStreak(p.streak, today),
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

/**
 * 今日か昨日に学んでいれば続いている。空いた日 (昨日まで) を休みの札で埋められるうちも続いている
 * (今日学べば札を使う)。埋められなければ 0
 */
export function currentStreak(p: Progress, now: Date): number {
  const today = dayKey(now);
  if (p.streak.lastDay === today || p.streak.lastDay === addDays(today, -1)) return p.streak.count;
  const missed = missedDays(p.streak.lastDay, today);
  return missed !== null && missed <= (p.streak.freezes ?? 0) ? p.streak.count : 0;
}

/** 札の表示: "休みの札 1 / 2"。使った日は新しいものから 3 つまで "· 11/20・11/21 に使った"、今日学ぶと使うなら "· 今日学ぶと 1 個使う" */
export function freezeText(f: { have: number; used: string[]; pending: number }): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const used = f.used.slice(-3).map(md).join('・');
  return `休みの札 ${f.have} / ${MAX_FREEZES}${f.pending > 0 ? ` · 今日学ぶと ${f.pending} 個使う` : ''}${used ? ` · ${used} に使った` : ''}`;
}

/** 休みの札の数と、使った日 (古い順)。pending は今日学ぶと札を使う日の数 (0 なら使わない) */
export function freezeStatus(p: Progress, now: Date): { have: number; used: string[]; pending: number } {
  const missed = missedDays(p.streak.lastDay, dayKey(now));
  const have = p.streak.freezes ?? 0;
  return { have, used: p.streak.used ?? [], pending: missed !== null && missed >= 1 && missed <= have && p.streak.count > 0 ? missed : 0 };
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
