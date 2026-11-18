import { describe, expect, it } from 'vitest';
import { allQuestions } from '../src/content';
import glossary from '../src/content/glossary.json';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { EXAM_ONLY } from '../src/content/examBank';
import type { GlossaryTerm } from '../src/lib/glossary';
import { lessonOfQuestion, termsInQuestion, topicsForQuestion } from '../src/lib/readMore';
import { termNames } from '../src/lib/termLinks';

const TERMS = (glossary as { terms: GlossaryTerm[] }).terms;
const NAMES = termNames(TERMS);

describe('答えたあとの読み直す先', () => {
  it('レッスンの問題は、そのレッスンを練習に持つトピックを出す', () => {
    expect(lessonOfQuestion('w3-l2-q4')).toBe('w3-l2');
    expect(lessonOfQuestion('x-fd1-001')).toBeUndefined();
    const withTopic = allQuestions().find((r) => HANDBOOK_TOPICS.some((t) => t.lessons.includes(r.lesson.id)))!;
    const ids = topicsForQuestion(withTopic.question, [], TERMS, HANDBOOK_TOPICS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(HANDBOOK_TOPICS.find((t) => t.id === id)?.lessons).toContain(withTopic.lesson.id);
  });
  it('問題に出てくる語を、出てくる順に重なりなく拾う', () => {
    const q = { id: 't', type: 'choice' as const, prompt: 'Pod を Deployment で管理する。Pod は', choices: [{ id: 'a', text: 'ReplicaSet' }], answer: 'a', explanation: 'x', source: 'https://kubernetes.io/' };
    expect(termsInQuestion(q, NAMES)).toEqual(['pod', 'deployment', 'replicaset']);
  });
  it('模擬試験用の問題も、出てくる語からトピックを出せる (ほとんどの問題に読み直す先がある)', () => {
    const none = EXAM_ONLY.filter((r) => topicsForQuestion(r.question, termsInQuestion(r.question, NAMES), TERMS, HANDBOOK_TOPICS).length === 0);
    expect(none.length, none.map((r) => r.question.id).join(', ')).toBeLessThanOrEqual(EXAM_ONLY.length / 10);
  });
  it('レッスンの問題は、ほとんどが読み直すトピックを持つ', () => {
    const all = allQuestions();
    const none = all.filter((r) => topicsForQuestion(r.question, termsInQuestion(r.question, NAMES), TERMS, HANDBOOK_TOPICS).length === 0);
    expect(none.length, none.map((r) => r.question.id).join(', ')).toBeLessThanOrEqual(all.length / 10);
  });
});
