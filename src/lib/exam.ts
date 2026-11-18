// 模擬試験: 問題を配点の割合で選び、最後にまとめて採点する
import type { Domain, Question } from '../content/types';
import { XP_PER_CORRECT, gradeChoice, gradeFill } from './grade';
import { addExamRecord, completeReview, recordAnswer, type Progress } from './progress';
import { shuffleChoices } from './shuffle';

export const EXAM_QUESTIONS = 60;
export const EXAM_MINUTES = 90;
/** 合格点。LF の多肢選択式試験に共通の記述 (KCNA と名指しではない)。正本の出典は content/guide.ts の EXAM_FACTS */
export const PASS_MARK = 0.75;

/** 試験の 4 分野の配点 (%)。正本は Linux Foundation の KCNA の試験のページ */
export const EXAM_WEIGHTS: Record<Domain, number> = {
  'Kubernetes Fundamentals': 44,
  'Container Orchestration': 28,
  'Cloud Native Application Delivery': 16,
  'Cloud Native Architecture': 12,
};

export type BankItem = { question: Question; domain: Domain };

/** 配点の割合で各分野の問題の数を決める (端数は大きい順に配り、合計を total にそろえる) */
export function domainCounts(total: number = EXAM_QUESTIONS): Record<Domain, number> {
  const entries = Object.entries(EXAM_WEIGHTS) as [Domain, number][];
  const raw = entries.map(([d, w]) => ({ d, exact: (total * w) / 100 }));
  const out = Object.fromEntries(raw.map((r) => [r.d, Math.floor(r.exact)])) as Record<Domain, number>;
  let rest = total - Object.values(out).reduce((s, n) => s + n, 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (rest <= 0) break;
    out[r.d]++;
    rest--;
  }
  return out;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 問題の束から、分野ごとの数だけ重ならずに選び、並びと 4 択の選択肢を混ぜる */
export function pickExamQuestions(bank: BankItem[], random: () => number = Math.random, total: number = EXAM_QUESTIONS): BankItem[] {
  const counts = domainCounts(total);
  const picked: BankItem[] = [];
  for (const [domain, n] of Object.entries(counts) as [Domain, number][]) {
    const pool = shuffled(bank.filter((b) => b.domain === domain), random);
    picked.push(...pool.slice(0, n));
  }
  return shuffled(picked, random).map((b) => ({ ...b, question: shuffleChoices(b.question, random) }));
}

export type ExamAnswer = string | undefined;

/** 答えたか (空白だけは答えなしとみなす) */
export const isAnswered = (answer: ExamAnswer): answer is string => answer !== undefined && answer.trim() !== '';

export function isCorrect(q: Question, answer: ExamAnswer): boolean {
  if (!isAnswered(answer)) return false;
  return q.type === 'fill' ? gradeFill(q, answer) : gradeChoice(q, answer);
}

export type ExamResult = {
  correct: number;
  total: number;
  byDomain: Record<Domain, { right: number; total: number }>;
};

export function gradeExam(items: BankItem[], answers: ExamAnswer[]): ExamResult {
  const byDomain = Object.fromEntries((Object.keys(EXAM_WEIGHTS) as Domain[]).map((d) => [d, { right: 0, total: 0 }])) as ExamResult['byDomain'];
  let correct = 0;
  items.forEach((item, i) => {
    const ok = isCorrect(item.question, answers[i]);
    byDomain[item.domain].total++;
    if (ok) {
      byDomain[item.domain].right++;
      correct++;
    }
  });
  return { correct, total: items.length, byDomain };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 採点の結果を記録に入れる。答えた問題だけを復習の規則で記録し (答えなしは記録しない。
 * 途中の復習の段階を戻さないため)、正解の数の XP と試験の結果を足す
 */
export function recordExam(p: Progress, items: BankItem[], answers: ExamAnswer[], now: Date): Progress {
  let next = p;
  let correct = 0;
  items.forEach((item, i) => {
    const a = answers[i];
    if (!isAnswered(a)) return;
    const ok = isCorrect(item.question, a);
    if (ok) correct++;
    next = recordAnswer(next, item.question.id, ok, now);
  });
  next = completeReview(next, correct * XP_PER_CORRECT, now);
  return addExamRecord(next, { at: now.toISOString(), correct, total: items.length });
}
