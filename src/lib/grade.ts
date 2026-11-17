import type { ChoiceQuestion, FillQuestion } from '../content/types';

/** 前後の空白を除き、間の空白の並びを 1 つにする。大文字と小文字はそのまま (kubectl も YAML の kind も区別する) */
export function normalizeAnswer(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function gradeFill(q: Pick<FillQuestion, 'answers'>, input: string): boolean {
  const value = normalizeAnswer(input);
  if (value === '') return false;
  return q.answers.some((a) => normalizeAnswer(a) === value);
}

export function gradeChoice(q: Pick<ChoiceQuestion, 'answer'>, choiceId: string): boolean {
  return q.answer === choiceId;
}

/** 1 問正解ごとの XP と、実習を終えたときの XP */
export const XP_PER_CORRECT = 3;
export const XP_PER_LAB = 10;
