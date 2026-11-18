import { describe, expect, it } from 'vitest';
import { questionBank } from '../src/content';
import examSets from '../src/content/examSets.json';
import { defaultChoice, examSetItems, lastExamOf, recordExam, startExam, validateExamSets, type ExamSet } from '../src/lib/exam';
import { MAX_EXAM_RECORDS, addExamRecord } from '../src/lib/progress';
import { emptyProgress, parseProgressText } from '../src/lib/progress';

const SETS = (examSets as { sets: ExamSet[] }).sets;
const bank = questionBank();

describe('模擬試験の決まった回', () => {
  it('3 回あり、どれも 60 問で配点どおり、実在する問題で、回どうしで重ならない', () => {
    expect(SETS).toHaveLength(3);
    expect(validateExamSets(SETS, bank)).toEqual([]);
  });
  it('検査は、重なり・数・配点・知らない問題・番号の飛びを見つける', () => {
    const [a, b] = SETS;
    expect(validateExamSets([a, { ...b, questions: [a.questions[0], ...b.questions.slice(1)] }], bank).join()).toMatch(/重なって/);
    expect(validateExamSets([{ ...a, questions: a.questions.slice(1) }], bank).join()).toMatch(/59 問/);
    expect(validateExamSets([{ ...a, questions: [...a.questions.slice(1), 'no-such-q'] }], bank).join()).toMatch(/という問題はありません/);
    const fd = a.questions.find((id) => bank.find((x) => x.question.id === id)?.domain === 'Kubernetes Fundamentals')!;
    const arch = bank.find((x) => x.domain === 'Cloud Native Architecture' && !SETS.some((s) => s.questions.includes(x.question.id)))!;
    expect(validateExamSets([{ ...a, questions: a.questions.map((id) => (id === fd ? arch.question.id : id)) }], bank).join()).toMatch(/配点どおりなら/);
    expect(validateExamSets([{ ...a, id: 2 }], bank).join()).toMatch(/1 から順に/);
  });
  it('どの回にも第 1〜8 週の問題が入る (前半の週に偏らない)', () => {
    const weekOf = (id: string) => Number(id.match(/^w(\d+)-/)?.[1]);
    for (const s of SETS) expect(new Set(s.questions.map(weekOf)).size, `第 ${s.id} 回`).toBe(8);
  });
  it('決まった回は毎回同じ問題で、順番は混ぜる', () => {
    const one = examSetItems(bank, SETS[0], () => 0.3).map((b) => b.question.id);
    expect([...one].sort()).toEqual([...SETS[0].questions].sort());
    expect(one).not.toEqual(SETS[0].questions);
  });
  it('記録に回の番号を残し、読み込みでも保つ (ランダムには付けない)', () => {
    const items = examSetItems(bank, SETS[1]);
    const now = new Date('2026-11-18T00:00:00Z');
    const p = recordExam(emptyProgress(), items, [], now, 2);
    expect(p.exams?.[0].set).toBe(2);
    expect(recordExam(emptyProgress(), items, [], now).exams?.[0].set).toBeUndefined();
    const loaded = parseProgressText(JSON.stringify({ v: 1, exams: [{ at: now.toISOString(), correct: 40, total: 60, set: 3 }, { at: now.toISOString(), correct: 40, total: 60, set: 'x' }] }));
    expect(loaded?.exams?.map((e) => e.set)).toEqual([3, undefined]);
    const odd = parseProgressText(JSON.stringify({ v: 1, exams: [0, -1, 1.5, 2].map((set) => ({ at: now.toISOString(), correct: 1, total: 60, set })) }));
    expect(odd?.exams?.map((e) => e.set)).toEqual([undefined, undefined, undefined, 2]);
  });
  it('ランダムを選ぶと回の番号は付かず、決まった回はその番号になる (前の回の番号を持ち越さない)', () => {
    expect(startExam(2, SETS, bank).set).toBe(2);
    const r = startExam('random', SETS, bank);
    expect(r.set).toBeUndefined();
    expect(r.items).toHaveLength(60);
  });
  it('前回の結果は、同じ回の記録のうち新しいほう', () => {
    const at = '2026-11-18T00:00:00.000Z';
    let p = emptyProgress();
    p = addExamRecord(p, { at, correct: 30, total: 60, set: 1 });
    p = addExamRecord(p, { at, correct: 50, total: 60, set: 1 });
    expect(lastExamOf(p.exams, 1)?.correct).toBe(50);
  });
  it('記録が上限を超えても、回ごとの最新は残る (「まだ解いていません」と誤って出さない)', () => {
    const at = '2026-11-18T00:00:00.000Z';
    let p = addExamRecord(emptyProgress(), { at, correct: 45, total: 60, set: 1 });
    for (let i = 0; i < MAX_EXAM_RECORDS + 5; i++) p = addExamRecord(p, { at, correct: i, total: 60 });
    expect(lastExamOf(p.exams, 1)?.correct).toBe(45);
    expect(p.exams).toHaveLength(MAX_EXAM_RECORDS + 1);
  });
  it('最初に選ぶのは、まだ解いていない最初の回 (全部解いたらランダム)', () => {
    const at = '2026-11-18T00:00:00.000Z';
    expect(defaultChoice([], SETS)).toBe(1);
    expect(defaultChoice([{ at, correct: 1, total: 60, set: 1 }], SETS)).toBe(2);
    expect(defaultChoice([1, 2, 3].map((set) => ({ at, correct: 1, total: 60, set })), SETS)).toBe('random');
  });
});
