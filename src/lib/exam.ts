// 模擬試験: 問題を配点の割合で選び、最後にまとめて採点する
import type { Domain, Question } from '../content/types';
import { XP_PER_CORRECT, gradeChoice, gradeFill } from './grade';
import { addExamRecord, completeReview, recordAnswer, type ExamRecord, type Progress } from './progress';
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

/** 決まった回: 問題の id の並び。正本は content/examSets.json、形は validateExamSets が検査する */
export type ExamSet = { id: number; questions: string[] };

/** 決まった回の問題を束から引き、並びと 4 択の選択肢を混ぜる (問題は毎回同じ、順番は変わる) */
export function examSetItems(bank: BankItem[], set: ExamSet, random: () => number = Math.random): BankItem[] {
  const byId = new Map(bank.map((b) => [b.question.id, b]));
  const items = set.questions.map((id) => byId.get(id)).filter((b): b is BankItem => b !== undefined);
  return shuffled(items, random).map((b) => ({ ...b, question: shuffleChoices(b.question, random) }));
}

/** 決まった回の検査: 回の番号が 1 から続く・どの回も 60 問で配点どおり・実在する問題・回どうしで重ならない */
export function validateExamSets(sets: ExamSet[], bank: BankItem[], total: number = EXAM_QUESTIONS): string[] {
  const errors: string[] = [];
  const byId = new Map(bank.map((b) => [b.question.id, b]));
  const counts = domainCounts(total);
  const seen = new Map<string, number>();
  sets.forEach((set, i) => {
    if (set.id !== i + 1) errors.push(`${i + 1} 番目の回の id が ${set.id} です (1 から順に振ります)`);
    if (set.questions.length !== total) errors.push(`第 ${set.id} 回: ${set.questions.length} 問です (${total} 問にします)`);
    const per = Object.fromEntries(Object.keys(EXAM_WEIGHTS).map((d) => [d, 0])) as Record<Domain, number>;
    for (const id of set.questions) {
      const b = byId.get(id);
      if (!b) {
        errors.push(`第 ${set.id} 回: ${id} という問題はありません`);
        continue;
      }
      per[b.domain]++;
      if (seen.has(id)) errors.push(`第 ${set.id} 回: ${id} は第 ${seen.get(id)} 回と重なっています`);
      else seen.set(id, set.id);
    }
    for (const d of Object.keys(counts) as Domain[]) if (per[d] !== counts[d]) errors.push(`第 ${set.id} 回: ${d} が ${per[d]} 問です (配点どおりなら ${counts[d]} 問)`);
  });
  return errors;
}

/** 回の選択。決まった回は番号、毎回選び直す回は random */
export type ExamChoice = number | 'random';

/** 選んだ回の問題と、記録に残す回の番号 (ランダムには付けない) */
export function startExam(choice: ExamChoice, sets: ExamSet[], bank: BankItem[], random: () => number = Math.random): { items: BankItem[]; set?: number } {
  const chosen = choice === 'random' ? undefined : sets.find((x) => x.id === choice);
  return chosen ? { items: examSetItems(bank, chosen, random), set: chosen.id } : { items: pickExamQuestions(bank, random) };
}

/** その回のいちばん新しい記録 (記録は新しい順) */
export const lastExamOf = (exams: ExamRecord[] | undefined, set: number) => exams?.find((e) => e.set === set);

/** 最初に選んでおく回: まだ解いていない最初の回。全部解いていればランダム */
export function defaultChoice(exams: ExamRecord[] | undefined, sets: ExamSet[]): ExamChoice {
  return sets.find((s) => !lastExamOf(exams, s.id))?.id ?? 'random';
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
export function recordExam(p: Progress, items: BankItem[], answers: ExamAnswer[], now: Date, set?: number): Progress {
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
  return addExamRecord(next, { at: now.toISOString(), correct, total: items.length, ...(set ? { set } : {}) });
}
