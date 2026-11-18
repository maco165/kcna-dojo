import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import { CURRICULUM } from '../src/content/guide';
import { HANDBOOK, HANDBOOK_TOPICS, findTopic, topicByCompetency } from '../src/content/handbook';
import { validateHandbook } from '../src/lib/handbook';

const domains = new Map(CURRICULUM.map((c) => [c.domain as string, c.competencies.map((x) => x.en)]));
const lessonIds = new Set(WEEKS.flatMap((w) => (w.content?.lessons ?? []).map((l) => l.id)));

describe('ハンドブックのデータ', () => {
  it('検査を通る (形・細目の原文・id の重複・実在するレッスン・https の出典)', () => {
    expect(validateHandbook(HANDBOOK, domains, lessonIds)).toEqual([]);
  });
  it('名前空間 try-kcna を作る試す手順は、それを消して終わる (読むだけの手順は何も作らない)', () => {
    for (const t of HANDBOOK_TOPICS) {
      for (const x of t.try) {
        const codes = x.steps.map((s) => s.code?.text ?? '');
        const creates = codes.some((c) => /kubectl create (namespace|ns) try-kcna|-n try-kcna .*--create-namespace/.test(c));
        const last = codes[codes.length - 1];
        if (creates) expect(last, `${t.id}: ${x.goal}`).toMatch(/kubectl delete (namespace|ns) try-kcna/);
        else expect(codes.join('\n'), `${t.id}: ${x.goal} (作らない手順は apply/create/delete をしない)`).not.toMatch(/kubectl (apply|create|delete|run|label|taint|patch|scale)\b/);
      }
    }
  });
  it('前後のトピックと、細目からの引き当て', () => {
    const first = HANDBOOK_TOPICS[0];
    expect(findTopic(first.id)?.prev).toBeUndefined();
    expect(topicByCompetency(first.competency)?.id).toBe(first.id);
    expect(findTopic('no-such-topic')).toBeUndefined();
  });
});

describe('validateHandbook', () => {
  const ok = {
    domain: 'Kubernetes Fundamentals',
    topics: [
      {
        id: 'core',
        competency: 'Kubernetes Core Concepts',
        title: 't',
        summary: 's',
        flow: [{ text: 'a' }, { text: 'b', code: { language: 'bash', text: 'kubectl get pods' } }, { text: 'c', output: 'x' }],
        try: [{ goal: 'g', steps: [{ text: 'x', code: { language: 'bash', text: 'kubectl delete namespace try-kcna' } }] }],
        lessons: ['w1-l1'],
        sources: [{ label: 'k', url: 'https://kubernetes.io/' }],
      },
    ],
  };
  const check = (mut: (t: Record<string, unknown>) => void) => {
    const d = structuredClone(ok);
    mut(d.topics[0] as unknown as Record<string, unknown>);
    return validateHandbook([d], domains, new Set(['w1-l1']));
  };
  it('正しい形は通る', () => expect(check(() => {})).toEqual([]));
  it('壊れた形を見つける', () => {
    expect(check((t) => (t.competency = 'Core Concept'))[0]).toMatch(/competency/);
    expect(check((t) => (t.flow = [{ text: 'a' }]))[0]).toMatch(/3 段以上/);
    expect(check((t) => (t.flow = [{ text: 'a' }, { text: 'b' }, { text: 'c', code: { language: 'python', text: 'x' } }]))[0]).toMatch(/bash か yaml/);
    expect(check((t) => (t.lessons = ['w9-l9']))[0]).toMatch(/w9-l9/);
    expect(check((t) => (t.sources = [{ label: 'k', url: 'http://x' }]))[0]).toMatch(/https/);
    expect(check((t) => (t.extra = 1))[0]).toMatch(/extra/);
    expect(check((t) => (t.id = 'Core_Concepts'))[0]).toMatch(/kebab-case/);
  });
});
