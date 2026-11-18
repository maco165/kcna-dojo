import { describe, expect, it } from 'vitest';
import { allQuestions } from '../src/content';
import glossary from '../src/content/glossary.json';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { EXAM_ONLY } from '../src/content/examBank';
import { weakDomains } from '../src/lib/exam';
import type { GlossaryTerm } from '../src/lib/glossary';
import { lessonOfQuestion, termsInQuestion, topicsForQuestion } from '../src/lib/readMore';
import { termNames } from '../src/lib/termLinks';

const TERMS = (glossary as { terms: GlossaryTerm[] }).terms;
const NAMES = termNames(TERMS);
const topicsOf = (r: { question: Parameters<typeof termsInQuestion>[0]; domain: string }) => topicsForQuestion(r.question, termsInQuestion(r.question, NAMES), TERMS, HANDBOOK_TOPICS, r.domain);
const domainOf = (id: string) => HANDBOOK_TOPICS.find((t) => t.id === id)?.domain;

describe('答えたあとの読み直す先', () => {
  it('レッスンの問題は、そのレッスンを練習に持つトピックを先に出す', () => {
    expect(lessonOfQuestion('w3-l2-q4')).toBe('w3-l2');
    expect(lessonOfQuestion('x-fd1-001')).toBeUndefined();
    const r = allQuestions().find((x) => HANDBOOK_TOPICS.some((t) => t.lessons.includes(x.lesson.id) && t.domain === x.domain))!;
    const first = topicsOf(r)[0];
    expect(HANDBOOK_TOPICS.find((t) => t.id === first)?.lessons).toContain(r.lesson.id);
  });
  it('問題文・コード・選択肢・解説に出てくる語を、出てくる順に重なりなく拾う', () => {
    const q = { id: 't', type: 'choice' as const, prompt: 'Pod を Deployment で管理する。Pod は', code: { language: 'bash', text: 'kubectl get rs' }, choices: [{ id: 'a', text: 'ReplicaSet' }], answer: 'a', explanation: 'x', source: 'https://kubernetes.io/' };
    expect(termsInQuestion(q, NAMES)).toEqual(['pod', 'deployment', 'kubectl', 'replicaset']);
  });
  it('どこにでも出る語 (Pod など) は、分野が分からなければトピックを決める材料にしない', () => {
    const q = { id: 'x-t-1', type: 'choice' as const, prompt: 'Pod とは', choices: [{ id: 'a', text: 'x' }], answer: 'a', explanation: 'x', source: 'https://kubernetes.io/' };
    expect(topicsForQuestion(q, ['pod'], TERMS, HANDBOOK_TOPICS)).toEqual([]);
  });
  it('模擬試験用の問題: Service の問題にネットワークが出て、9 割以上が自分の分野のトピックを含む', () => {
    const co2 = EXAM_ONLY.find((r) => r.question.id === 'x-co-002')!;
    expect(topicsOf(co2)).toContain('networking');
    const own = EXAM_ONLY.filter((r) => topicsOf(r).some((id) => domainOf(id) === r.domain));
    expect(own.length / EXAM_ONLY.length).toBeGreaterThanOrEqual(0.9);
    // 同じ組み合わせばかりが並ばない。Pod・kubectl のような語しか出ない問題は、分野の基本のトピックにまとまるので、15% までは許す
    const combos = new Map<string, number>();
    for (const r of EXAM_ONLY) combos.set(topicsOf(r).join(','), (combos.get(topicsOf(r).join(',')) ?? 0) + 1);
    expect(Math.max(...combos.values())).toBeLessThanOrEqual(EXAM_ONLY.length * 0.15);
    // 範囲外のトピックが 1 つ目に来るのはまれ
    expect(EXAM_ONLY.filter((r) => String(domainOf(topicsOf(r)[0] ?? '') ?? '').startsWith('付録')).length).toBeLessThanOrEqual(EXAM_ONLY.length / 10);
  });
  it('レッスンの問題は、ほとんどが読み直すトピックを持ち、1 つ目が範囲外になることはまれ', () => {
    const all = allQuestions();
    const none = all.filter((r) => topicsOf(r).length === 0);
    expect(none.length, none.map((r) => r.question.id).join(', ')).toBeLessThanOrEqual(all.length / 10);
    const appendixFirst = all.filter((r) => String(domainOf(topicsOf(r)[0] ?? '') ?? '').startsWith('付録'));
    expect(appendixFirst.length).toBeLessThanOrEqual(all.length / 10);
  });
  it('模擬試験の結果: 目安に届かなかった分野だけを出し、出題の無い分野は出さない', () => {
    const r = { correct: 0, total: 0, byDomain: { 'Kubernetes Fundamentals': { right: 20, total: 26 }, 'Container Orchestration': { right: 14, total: 17 }, 'Cloud Native Application Delivery': { right: 7, total: 10 }, 'Cloud Native Architecture': { right: 0, total: 0 } } };
    expect(weakDomains(r)).toEqual(['Cloud Native Application Delivery']);
  });
});
