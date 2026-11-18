import { describe, expect, it } from 'vitest';
import { questionBank } from '../src/content';
import examSets from '../src/content/examSets.json';
import { examSetItems, recordExam, validateExamSets, type ExamSet } from '../src/lib/exam';
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
  });
});
