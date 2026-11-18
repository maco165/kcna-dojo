import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import { CURRICULUM } from '../src/content/guide';
import { HANDBOOK, HANDBOOK_TOPICS, findTopic, isAppendixDomain, topicByCompetency } from '../src/content/handbook';
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
  // ok は 1 分野 1 細目だけなので、それ以外の細目の欠けは数えない小さな分野表で検査する
  const one = new Map([['Kubernetes Fundamentals', ['Kubernetes Core Concepts']]]);
  const check = (mut: (t: Record<string, unknown>) => void) => {
    const d = structuredClone(ok);
    mut(d.topics[0] as unknown as Record<string, unknown>);
    return validateHandbook([d], one, new Set(['w1-l1']));
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
    expect(check((t) => (t.try = []))[0]).toMatch(/1 つ以上/);
    expect(check((t) => ((t.flow as Record<string, unknown>[])[1] = { text: 'b', code: { language: 'bash', text: 'kubectl get pods' }, result: { text: 'x', tone: 'maybe' } }))[0]).toMatch(/tone/);
    expect(check((t) => ((t.flow as Record<string, unknown>[])[0] = { text: 'a', result: { text: 'x', tone: 'ok' } }))[0]).toMatch(/コードのある手順/);
    expect(check((t) => ((t.flow as Record<string, unknown>[])[1] = { text: 'b', code: { language: 'bash', text: 'kubectl get pods' }, result: { text: 'あ'.repeat(41), tone: 'ok' } }))[0]).toMatch(/40 字/);
    expect(check((t) => ((t.flow as Record<string, unknown>[])[2] = { text: 'c', outptu: 'x' }))[0]).toMatch(/outptu/);
    expect(check((t) => (t.lessons = ['w1-l1', 'w1-l1']))[0]).toMatch(/重なって/);
    expect(check((t) => (t.sources = [{ label: 'a', url: 'https://k/' }, { label: 'b', url: 'https://k/' }]))[0]).toMatch(/同じ URL/);
  });
  it('細目の欠けと、同じ分野のファイルの重なりを見つける', () => {
    const full = validateHandbook(HANDBOOK, domains, lessonIds);
    expect(full).toEqual([]);
    const missingTopic = structuredClone(HANDBOOK);
    missingTopic[0].topics.pop();
    expect(validateHandbook(missingTopic, domains, lessonIds).join()).toMatch(/トピックがありません/);
    expect(validateHandbook(HANDBOOK.slice(1), domains, lessonIds).join()).toMatch(/ファイルがありません/);
    expect(validateHandbook([...HANDBOOK, { domain: HANDBOOK[0].domain, topics: [] }], domains, lessonIds).join()).toMatch(/2 つあります/);
  });
  it('付録は目次の最後に置き、細目とは照らさず、細目からは引き当てない', () => {
    // 付録の段はすべて 4 分野のあと
    const firstApp = HANDBOOK.findIndex((d) => isAppendixDomain(d.domain));
    expect(firstApp).toBeGreaterThan(0);
    expect(HANDBOOK.slice(firstApp).every((d) => isAppendixDomain(d.domain))).toBe(true);
    expect(HANDBOOK.slice(firstApp).map((d) => d.domain)).toEqual(['付録: Kubernetes をもっと知る', '付録: Linux とコンテナ', '付録: コミュニティ', '付録: 作って届ける', '付録: クラウド']);
    expect(HANDBOOK_TOPICS.filter((t) => !isAppendixDomain(t.domain))).toHaveLength([...domains.values()].flat().length);
    const app = HANDBOOK.find((d) => isAppendixDomain(d.domain))!;
    expect(topicByCompetency(app.topics[0].competency)).toBeUndefined();
    const others = HANDBOOK.filter((d) => !isAppendixDomain(d.domain));
    expect(validateHandbook(others, domains, lessonIds)).toEqual([]);
    const bad = structuredClone(app);
    bad.topics[0].competency = '';
    expect(validateHandbook([...others, bad], domains, lessonIds).join()).toMatch(/小見出し/);
    expect(validateHandbook([...others, { ...app, topics: [] }], domains, lessonIds).join()).toMatch(/1 つ以上/);
    expect(validateHandbook([...others, app, { ...app, topics: [] }], domains, lessonIds).join()).toMatch(/付録: Kubernetes をもっと知る のファイルが 2 つあります/);
    expect(validateHandbook([...others, { ...app, domain: '付録: ' }], domains, lessonIds).join()).toMatch(/段の名前/);
    const twin = structuredClone(app);
    twin.topics.push({ ...structuredClone(app.topics[0]), id: 'twin-topic' });
    expect(validateHandbook([...others, twin], domains, lessonIds).join()).toMatch(/competency .* のトピックが 2 つあります/);
    expect(validateHandbook([{ domain: 'X', topics: [] }], domains, lessonIds).join()).toMatch(/4 分野のどれかか/);
  });
});
