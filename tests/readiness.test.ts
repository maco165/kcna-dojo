import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../src/content/guide';
import examSets from '../src/content/examSets.json';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { WEEK_CONTENTS } from '../src/content/lessons';
import { COMPETENCY_TARGET, FRESH_SETS, RECENT_EXAMS, competencyLessons, readiness } from '../src/lib/readiness';
import { PASS_MARK } from '../src/lib/exam';
import { emptyProgress, type ExamRecord, type Progress } from '../src/lib/progress';

const lessons = competencyLessons();
const allQ = lessons.flatMap((c) => c.lessons.flatMap((l) => l.questions));
/** 問題の id ごとに、2 回続けて正解した記録にする */
const twice = (ids: string[], p: Progress = emptyProgress()): Progress => ({ ...p, answers: { ...p.answers, ...Object.fromEntries(ids.map((id) => [id, { right: 2, wrong: 0, last: '', run: 2 }])) } });
const exam = (correct: number, set?: number): ExamRecord => ({ at: '2026-11-28T00:00:00.000Z', correct, total: 60, ...(set ? { set } : {}) });
const withExams = (p: Progress, exams: ExamRecord[]): Progress => ({ ...p, exams });

describe('受験の目安の元', () => {
  it('細目ごとの問題は、その細目を持つレッスンの問題 (全文のデータと同じ)', () => {
    expect(lessons.map((c) => c.en)).toEqual(CURRICULUM.flatMap((c) => c.competencies.map((x) => x.en)));
    for (const c of lessons) {
      const want = WEEK_CONTENTS.flatMap((w) => w.lessons.filter((l) => l.kind === 'quiz' && l.competency === c.en));
      expect(c.lessons.map((l) => l.id), c.en).toEqual(want.map((l) => l.id));
      expect(c.lessons.flatMap((l) => l.questions), c.en).toEqual(want.flatMap((l) => (l.kind === 'quiz' ? l.questions.map((q) => q.id) : [])));
    }
  });
  it('細目ごとのハンドブックのトピックは、同じ細目のトピック', () => {
    for (const x of CURRICULUM.flatMap((c) => c.competencies)) expect(HANDBOOK_TOPICS.find((t) => t.id === x.topic)?.competency, x.en).toBe(x.en);
  });
  it('目安の数字: 細目は合格の目安と同じ 75%、模擬試験は直近 2 回。初見の回は第 4・5 回', () => {
    expect(COMPETENCY_TARGET).toBe(PASS_MARK);
    expect(PASS_MARK).toBe(0.75);
    expect(RECENT_EXAMS).toBe(2);
    expect(FRESH_SETS).toEqual([4, 5]);
    // 数で書いた初見の回は、examSets.json の「問題が全部 x- の回」と同じ
    expect(FRESH_SETS).toEqual(examSets.sets.filter((s) => s.questions.every((id) => id.startsWith('x-'))).map((s) => s.id));
  });
});

describe('受験の目安', () => {
  const allTwice = twice(allQ);
  it('何もしていなければ、13 細目とも足りず、模擬試験も足りない', () => {
    const r = readiness(emptyProgress());
    expect(r.ready).toBe(false);
    expect(r.short).toHaveLength(13);
    expect(r.exam).toEqual({ recent: [], ok: false, hasFresh: false });
  });
  it('全細目を 2 回続けて正解し、直近 2 回が 45/60 (75%) 以上で 1 回が初見の回なら、目安に届く', () => {
    const r = readiness(withExams(allTwice, [exam(45, 4), exam(50)]));
    expect(r.short).toEqual([]);
    expect(r.exam.ok).toBe(true);
    expect(r.ready).toBe(true);
  });
  it('境: 細目は 75% ちょうどで届き、1 問足りないと届かない', () => {
    const storage = lessons.find((c) => c.en === 'Storage')!.lessons.flatMap((l) => l.questions);
    const need = Math.ceil(storage.length * COMPETENCY_TARGET);
    const others = allQ.filter((id) => !storage.includes(id));
    const at = (n: number) => readiness(withExams(twice([...others, ...storage.slice(0, n)]), [exam(50, 5), exam(50)]));
    expect(at(need).short).toEqual([]);
    expect(at(need).ready).toBe(true);
    expect(at(need - 1).short.map((c) => c.en)).toEqual(['Storage']);
    expect(at(need - 1).ready).toBe(false);
  });
  it('境: 細目の割合がちょうど 75% (4 問中 3 問) なら届き、それより下なら届かない', () => {
    const synth = CURRICULUM.flatMap((c) => c.competencies).map((c, i) => ({ en: c.en, lessons: [{ id: `l${i}`, questions: [0, 1, 2, 3].map((n) => `c${i}-q${n}`) }] }));
    const ids = (k: number) => synth.flatMap((_, i) => [0, 1, 2, 3].slice(0, k).map((n) => `c${i}-q${n}`));
    expect(readiness(withExams(twice(ids(3)), [exam(45, 4), exam(45)]), synth)).toMatchObject({ ready: true, short: [] });
    expect(readiness(withExams(twice(ids(2)), [exam(45, 4), exam(45)]), synth).short).toHaveLength(13);
  });
  it('境: 模擬試験は 45/60 で届き、44/60 では届かない。直近 2 回のどちらかでも下なら届かない', () => {
    expect(readiness(withExams(allTwice, [exam(45, 4), exam(45, 1)])).ready).toBe(true);
    expect(readiness(withExams(allTwice, [exam(44, 4), exam(60, 1)])).ready).toBe(false);
    expect(readiness(withExams(allTwice, [exam(60, 4), exam(44, 1)])).ready).toBe(false);
    // 3 回目より前の結果は見ない
    expect(readiness(withExams(allTwice, [exam(50, 4), exam(50, 2), exam(10)])).ready).toBe(true);
  });
  it('直近 2 回が、レッスンの問題から出る回 (第 1〜3 回・ランダム) だけなら届かない', () => {
    const r = readiness(withExams(allTwice, [exam(60, 1), exam(60)]));
    expect(r.exam).toMatchObject({ ok: false, hasFresh: false });
    expect(r.ready).toBe(false);
    expect(readiness(withExams(allTwice, [exam(60, 5)])).exam.ok).toBe(false);
  });
  it('足りない細目は割合の低い順。次に解くレッスンは、その細目でまだ目安に届いていない最初のレッスン', () => {
    const core = lessons.find((c) => c.en === 'Kubernetes Core Concepts')!.lessons;
    const r = readiness(twice([...core[0].questions, ...core[1].questions, ...lessons.find((c) => c.en === 'Storage')!.lessons[0].questions]));
    const c = r.short.find((x) => x.en === 'Kubernetes Core Concepts')!;
    expect(c.next).toBe(core[2].id);
    expect(r.short.map((x) => x.rate)).toEqual([...r.short.map((x) => x.rate)].sort((a, b) => a - b));
    expect(r.short.at(-1)!.en).toBe('Storage');
  });
  it('1 回正解や、間違えた記録は「2 回続けて正解」に数えない', () => {
    const one = { ...allTwice, answers: Object.fromEntries(allQ.map((id) => [id, { right: 1, wrong: 0, last: '', run: 1 }])) };
    expect(readiness(withExams(one, [exam(50, 4), exam(50)])).short).toHaveLength(13);
  });
});
