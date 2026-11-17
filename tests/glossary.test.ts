import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/content/curriculum';
import glossary from '../src/content/glossary.json';
import { searchTerms, sortTerms, validateGlossary, type GlossaryTerm } from '../src/lib/glossary';

const lessonIds = new Set(WEEKS.flatMap((w) => (w.content?.lessons ?? []).map((l) => l.id)));
const terms = (glossary as { terms: GlossaryTerm[] }).terms;

describe('用語集のデータ', () => {
  it('検査を通る (id の重複・欄の欠け・https でない出典・無いレッスン・用語の重なりが無い)', () => {
    expect(validateGlossary(glossary, lessonIds)).toEqual([]);
  });
  it('80 語ほどある', () => {
    expect(terms.length).toBeGreaterThanOrEqual(70);
  });
});

describe('validateGlossary', () => {
  const ok: GlossaryTerm = { id: 'pod', term: 'Pod', description: '説明', source: 'https://kubernetes.io/', lessons: ['w1-l1'] };
  const check = (t: unknown[]) => validateGlossary({ terms: t }, new Set(['w1-l1']));
  it('正しい形は通る', () => expect(check([ok])).toEqual([]));
  it('壊れた形を見つける', () => {
    expect(check([ok, ok])[0]).toMatch(/id が重複/);
    expect(check([{ ...ok, source: 'http://x' }])[0]).toMatch(/https/);
    expect(check([{ ...ok, lessons: ['w9-l1'] }])[0]).toMatch(/w9-l1/);
    expect(check([{ ...ok, lessons: [] }])[0]).toMatch(/lessons が空/);
    expect(check([{ ...ok, description: '' }])[0]).toMatch(/description/);
    expect(check([ok, { ...ok, id: 'pod2', term: 'ポッド', aliases: ['pod'] }])[0]).toMatch(/重なって/);
    expect(validateGlossary({}, new Set())).toEqual(['terms の配列がありません']);
    expect(check([{ ...ok, aliases: 5 }])[0]).toMatch(/aliases/);
    expect(check([{ ...ok, alias: ['ポッド'] }])[0]).toMatch(/alias という欄/);
    expect(check([{ ...ok, lessons: ['w1-l1', 'w1-l1'] }])[0]).toMatch(/重なって/);
    expect(check([null])[0]).toMatch(/オブジェクト/);
  });
});

describe('searchTerms', () => {
  const t = (id: string, term: string, description: string, aliases?: string[]): GlossaryTerm => ({ id, term, description, aliases, source: 'https://x/', lessons: ['w1-l1'] });
  const list = [t('svc', 'Service', 'Pod の集まりに安定した入口を作る'), t('pod', 'Pod', 'コンテナの最小の単位', ['ポッド']), t('pv', 'PersistentVolume', '永続ボリューム', ['PV'])];
  it('空なら全部', () => expect(searchTerms(list, '  ')).toHaveLength(3));
  it('大文字・小文字と全角を区別せず、用語に当たるものを先に出す', () => {
    expect(searchTerms(list, 'ｐｏｄ').map((x) => x.id)).toEqual(['pod', 'svc']);
  });
  it('別名でも探せる', () => expect(searchTerms(list, 'pv').map((x) => x.id)).toEqual(['pv']));
  it('ひらがなでも、ハイフンを抜いても探せる', () => {
    expect(searchTerms(list, 'ぽっど').map((x) => x.id)).toEqual(['pod']);
    expect(searchTerms([t('kp', 'kube-proxy', 'ノードの通信')], 'kubeproxy').map((x) => x.id)).toEqual(['kp']);
  });
  it('完全一致の語を先に出す (実データ: pod で Pod が先頭)', () => {
    expect(searchTerms(sortTerms(terms), 'pod')[0].id).toBe('pod');
  });
  it('空白で区切った語はすべて含むものだけ', () => expect(searchTerms(list, 'pod 入口').map((x) => x.id)).toEqual(['svc']));
  it('読みの順に並べる', () => expect(sortTerms(list).map((x) => x.id)).toEqual(['pv', 'pod', 'svc']));
});
