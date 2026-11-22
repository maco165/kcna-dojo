// 模擬試験の途中の保存。再読み込みや開き直しで「続きから解く」を出すため、解いている回の問題の並び・
// 選択肢の並び・答え・いまの問題・残り時間の期限 (時刻) を localStorage の別のキーに置く。
// 進捗 (kcna.v1) とは分ける (様式を変えず、書き出す記録にも途中の答えを入れない)。採点したら・やめたら消す。
// 回ごとに id を持ち、採点した回の id は別のキーに残す。2 つのタブで同じ回を開いていても、片方が採点したあとに
// もう片方が保存し直したり、同じ回をもう一度採点して記録を 2 回付けたりしないため
import type { Question } from '../content/types';
import type { BankItem, ExamAnswer } from './exam';

export const EXAM_SAVE_KEY = 'kcna.exam.v1';
/** 採点した回の id (新しい順に最大 MAX_DONE 件) */
export const EXAM_DONE_KEY = 'kcna.exam.done.v1';
const MAX_DONE = 20;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 保存する形。order は 4 択の選択肢の id か、穴埋めの候補の画面の並び */
export type SavedExam = {
  v: 1;
  /** 回ごとの id (始めたときに作る) */
  id: string;
  /** 決まった回の番号 (ランダムは持たない) */
  set?: number;
  items: { id: string; order?: string[] }[];
  /** 答えなしは null (JSON に undefined を書けないため) */
  answers: (string | null)[];
  index: number;
  /** 時間切れになる時刻 (ミリ秒) */
  endsAt: number;
  /** 「あとで見直す」の印を付けた問題の番号 (0 から)。前の版の保存には無い。印が無ければ書かない */
  marks?: number[];
};

/** 解いている途中の状態。marks は問題ごとの「あとで見直す」の印 (無ければ印なし) */
export type ExamProgress = { id: string; set?: number; items: BankItem[]; answers: ExamAnswer[]; index: number; endsAt: number; marks?: boolean[] };

/** 印の数 */
export const markCount = (marks: boolean[] | undefined) => (marks ?? []).filter(Boolean).length;

/** 回の id を作る (始めた時刻と乱数) */
export const newExamId = (now: number = Date.now(), random: () => number = Math.random) => `${now.toString(36)}-${Math.floor(random() * 36 ** 6).toString(36)}`;

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

const orderOf = (q: Question): string[] | undefined => (q.type === 'choice' ? q.choices.map((c) => c.id) : q.candidates);

function finishedIds(storage: KeyValueStorage | undefined): string[] {
  try {
    const v = JSON.parse(storage?.getItem(EXAM_DONE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** その回をもう採点したか (ほかのタブで採点した回も) */
export const isFinished = (id: string, storage: KeyValueStorage | undefined = safeLocalStorage()) => finishedIds(storage).includes(id);

/**
 * 採点した回の id を残し、途中の保存を消す。もう採点した回なら false (記録を付けない)。
 * 呼ぶ側は true のときだけ記録を付ける
 */
export function finishExam(id: string, storage: KeyValueStorage | undefined = safeLocalStorage()): boolean {
  const done = finishedIds(storage);
  clearExam(storage);
  if (done.includes(id)) return false;
  try {
    storage?.setItem(EXAM_DONE_KEY, JSON.stringify([id, ...done].slice(0, MAX_DONE)));
  } catch {
    // 残せなくても、この画面では 1 回だけ記録する
  }
  return true;
}

/** 保存されている途中の回の id (無ければ null) */
function savedId(storage: KeyValueStorage): string | null {
  try {
    const v = JSON.parse(storage.getItem(EXAM_SAVE_KEY) ?? 'null');
    return v && typeof v.id === 'string' ? v.id : null;
  } catch {
    return null;
  }
}

/**
 * 途中の状態を保存する。保存できない環境では何もしない (その場限りで解ける)。
 * onlyIfCurrent のときは、保存がまだ自分の回のときだけ書く (ほかのタブが採点して消した・別の回を始めたなら書かない)。
 * 採点した回は書かない。書いたら true
 */
export function saveExam(e: ExamProgress, storage: KeyValueStorage | undefined = safeLocalStorage(), { onlyIfCurrent = false } = {}): boolean {
  if (!storage) return false;
  if (isFinished(e.id, storage)) return false;
  if (onlyIfCurrent && savedId(storage) !== e.id) return false;
  const saved: SavedExam = {
    v: 1,
    id: e.id,
    ...(e.set ? { set: e.set } : {}),
    items: e.items.map((b) => ({ id: b.question.id, order: orderOf(b.question) })),
    answers: e.items.map((_, i) => e.answers[i] ?? null),
    index: e.index,
    endsAt: e.endsAt,
  };
  const marks = (e.marks ?? []).flatMap((m, i) => (m && i < e.items.length ? [i] : []));
  if (marks.length > 0) saved.marks = marks;
  try {
    storage.setItem(EXAM_SAVE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    // 容量の上限などで保存できなくても、解くのは続けられる
    return false;
  }
}

export function clearExam(storage: KeyValueStorage | undefined = safeLocalStorage()): void {
  try {
    storage?.removeItem(EXAM_SAVE_KEY);
  } catch {
    // 消せない環境では何もしない
  }
}

/** 並びを保存した順に戻す。要素が保存したものと同じ組でなければ null (問題のデータが変わった) */
function reorder<T>(xs: T[], key: (x: T) => string, order: string[] | undefined): T[] | null {
  if (!order) return xs;
  if (order.length !== xs.length) return null;
  const byKey = new Map(xs.map((x) => [key(x), x]));
  const out = order.map((k) => byKey.get(k));
  return out.every((x) => x !== undefined) && new Set(order).size === order.length ? (out as T[]) : null;
}

/**
 * 保存した途中の状態を、問題の束から引き直して戻す。読めない・形が違う・束に無い問題がある・選択肢が変わった
 * ときは null (壊れた保存で画面を落とさず、模擬試験の最初から始める)
 */
export function loadExam(bank: BankItem[], storage: KeyValueStorage | undefined = safeLocalStorage()): ExamProgress | null {
  let raw: unknown;
  try {
    const text = storage?.getItem(EXAM_SAVE_KEY);
    if (!text) return null;
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const s = raw as Partial<SavedExam>;
  if (!s || s.v !== 1 || typeof s.id !== 'string' || !Array.isArray(s.items) || !Array.isArray(s.answers) || s.items.length === 0 || s.answers.length !== s.items.length) return null;
  if (typeof s.endsAt !== 'number' || !Number.isFinite(s.endsAt) || !Number.isInteger(s.index) || s.index! < 0 || s.index! >= s.items.length) return null;
  // ほかのタブでもう採点した回の保存は捨てる (続きから解いて、もう一度記録を付けないため)
  if (isFinished(s.id, storage)) {
    clearExam(storage);
    return null;
  }
  const byId = new Map(bank.map((b) => [b.question.id, b]));
  const items: BankItem[] = [];
  for (const it of s.items) {
    const b = it && typeof it.id === 'string' ? byId.get(it.id) : undefined;
    if (!b) return null;
    const order = Array.isArray(it.order) && it.order.every((x) => typeof x === 'string') ? it.order : undefined;
    const q = b.question;
    if (q.type === 'choice') {
      const choices = reorder(q.choices, (c) => c.id, order);
      if (!choices) return null;
      items.push({ ...b, question: { ...q, choices } });
    } else {
      const candidates = q.candidates ? reorder(q.candidates, (c) => c, order) : undefined;
      if (q.candidates && !candidates) return null;
      items.push({ ...b, question: candidates ? { ...q, candidates } : q });
    }
  }
  const answers = s.answers.map((a) => (typeof a === 'string' ? a : undefined));
  // 印は番号の並び。形の違う・範囲の外の番号は捨てる (印が読めなくても続きからは解ける)
  const marks = items.map(() => false);
  if (Array.isArray(s.marks)) for (const i of s.marks) if (Number.isInteger(i) && i >= 0 && i < items.length) marks[i] = true;
  return { id: s.id, ...(Number.isInteger(s.set) && s.set! >= 1 ? { set: s.set } : {}), items, answers, index: s.index!, endsAt: s.endsAt, marks };
}

/** 期限を過ぎているか (過ぎていれば、続きからではなく時間切れの結果にする) */
export const isExpired = (e: ExamProgress, now: number) => e.endsAt <= now;
