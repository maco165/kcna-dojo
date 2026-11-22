// 模擬試験の途中の保存。再読み込みや開き直しで「続きから解く」を出すため、解いている回の問題の並び・
// 選択肢の並び・答え・いまの問題・残り時間の期限 (時刻) を localStorage の別のキーに置く。
// 進捗 (kcna.v1) とは分ける (様式を変えず、書き出す記録にも途中の答えを入れない)。採点したら・やめたら消す。
import type { Question } from '../content/types';
import type { BankItem, ExamAnswer } from './exam';

export const EXAM_SAVE_KEY = 'kcna.exam.v1';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 保存する形。order は 4 択の選択肢の id か、穴埋めの候補の画面の並び */
export type SavedExam = {
  v: 1;
  /** 決まった回の番号 (ランダムは持たない) */
  set?: number;
  items: { id: string; order?: string[] }[];
  /** 答えなしは null (JSON に undefined を書けないため) */
  answers: (string | null)[];
  index: number;
  /** 時間切れになる時刻 (ミリ秒) */
  endsAt: number;
};

/** 解いている途中の状態 */
export type ExamProgress = { set?: number; items: BankItem[]; answers: ExamAnswer[]; index: number; endsAt: number };

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

const orderOf = (q: Question): string[] | undefined => (q.type === 'choice' ? q.choices.map((c) => c.id) : q.candidates);

/** 途中の状態を保存する。保存できない環境では何もしない (その場限りで解ける) */
export function saveExam(e: ExamProgress, storage: KeyValueStorage | undefined = safeLocalStorage()): void {
  if (!storage) return;
  const saved: SavedExam = {
    v: 1,
    ...(e.set ? { set: e.set } : {}),
    items: e.items.map((b) => ({ id: b.question.id, order: orderOf(b.question) })),
    answers: e.items.map((_, i) => e.answers[i] ?? null),
    index: e.index,
    endsAt: e.endsAt,
  };
  try {
    storage.setItem(EXAM_SAVE_KEY, JSON.stringify(saved));
  } catch {
    // 容量の上限などで保存できなくても、解くのは続けられる
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
  if (!s || s.v !== 1 || !Array.isArray(s.items) || !Array.isArray(s.answers) || s.items.length === 0 || s.answers.length !== s.items.length) return null;
  if (typeof s.endsAt !== 'number' || !Number.isFinite(s.endsAt) || !Number.isInteger(s.index) || s.index! < 0 || s.index! >= s.items.length) return null;
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
  return { ...(Number.isInteger(s.set) && s.set! >= 1 ? { set: s.set } : {}), items, answers, index: s.index!, endsAt: s.endsAt };
}

/** 期限を過ぎているか (過ぎていれば、続きからではなく時間切れの結果にする) */
export const isExpired = (e: ExamProgress, now: number) => e.endsAt <= now;
