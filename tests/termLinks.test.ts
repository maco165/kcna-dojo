import { describe, expect, it } from 'vitest';
import glossary from '../src/content/glossary.json';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import type { GlossaryTerm } from '../src/lib/glossary';
import { parseRoute } from '../src/lib/route';
import { linkDetail, makeTermLinker, termNames } from '../src/lib/termLinks';

const TERMS = (glossary as { terms: GlossaryTerm[] }).terms;
const names = termNames(TERMS);
const links = (text: string) => makeTermLinker(names)(text).filter((p) => typeof p !== 'string');

describe('本文の用語を用語集へのリンクにする', () => {
  it('長い名前を先に当てる (kube-controller-manager を controller より先に)', () => {
    expect(links('Pod Security Standards')).toEqual([{ text: 'Pod Security Standards', id: 'pod-security-standards' }]);
    // 並べ替えが逆でも同じ答えになる (termNames が長い順に並べる)
    expect(termNames([...TERMS].reverse()).map((n) => n.name.length)).toEqual([...termNames(TERMS).map((n) => n.name.length)].sort((a, b) => b - a));
    expect(links('kube-controller-manager が動く')).toEqual([{ text: 'kube-controller-manager', id: 'kube-controller-manager' }]);
  });
  it('英数字の語は語の切れ目だけで当てる (Pods・PodSecurity・podman には当てない)', () => {
    expect(links('Pods と PodSecurity と podman')).toEqual([]);
    expect(links('Pod を作る')).toEqual([{ text: 'Pod', id: 'pod' }]);
    expect(links('(Pod)')).toHaveLength(1);
    expect(links('imagePullSecret')).toEqual([]);
  });
  it('カタカナの語はカタカナの語の中に当てず、意味の広い別名は使わない', () => {
    expect(links('データベースとコントロールとロールアウト')).toEqual([]);
    expect(links('マイクロサービスと API へのリクエスト')).toEqual([]);
    expect(links('Kustomize のベースとオーバーレイ').map((p) => p.text)).toContain('ベース');
  });
  it('1 ページの中で同じ語は最初の 1 回だけ。別名でも同じ語なら 2 回目は文字のまま', () => {
    const link = makeTermLinker(names);
    expect(link('Pod と Pod').filter((p) => typeof p !== 'string')).toHaveLength(1);
    expect(link('もう一度 Pod').every((p) => typeof p === 'string')).toBe(true);
    const link2 = makeTermLinker(names);
    expect(link2('API サーバーと kube-apiserver').filter((p) => typeof p !== 'string')).toHaveLength(1);
  });
  it('2 回目の長い語の中の短い語には当てない (2 回目のヘッドレス Service の中の Service を拾わない)', () => {
    const link = makeTermLinker(names);
    expect(link('ヘッドレス Service').filter((p) => typeof p !== 'string')).toHaveLength(1);
    expect(link('ヘッドレス Service').filter((p) => typeof p !== 'string')).toEqual([]);
  });
  it('漢字の語は、カタカナや漢字に続くときは当てず、意味の広いロードバランサーも使わない', () => {
    expect(links('ネットワーク名前空間を共有する')).toEqual([]);
    expect(links('通信をロードバランサーで切り替える')).toEqual([]);
    expect(links('既定の名前空間')).toHaveLength(1);
  });
  it('つなぎ直すと元の文に戻る (文字を落とさない・足さない)', () => {
    for (const t of HANDBOOK_TOPICS) {
      const link = makeTermLinker(names);
      for (const text of [t.summary, ...t.flow.map((s) => s.text), ...t.try.flatMap((x) => x.steps.map((s) => s.text))]) {
        expect(link(text).map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(text);
      }
    }
  });
  it('括弧の付いた語は括弧の前だけ、1 字の名前は使わない', () => {
    expect(names.some((n) => n.name.includes('('))).toBe(false);
    expect(names.every((n) => n.name.length >= 2)).toBe(true);
    expect(names.find((n) => n.name === 'CI')?.id).toBe(TERMS.find((t) => t.term.startsWith('CI ('))?.id);
  });
  it('ハンドブックのどのトピックにも、用語集へのリンクが付く', () => {
    for (const t of HANDBOOK_TOPICS) {
      const link = makeTermLinker(names);
      const n = [t.summary, ...t.flow.map((s) => s.text), ...t.try.flatMap((x) => x.steps.map((s) => s.text))].flatMap(link).filter((p) => typeof p !== 'string').length;
      expect(n, t.id).toBeGreaterThan(0);
    }
  });
  it('/glossary/<id>/ で用語集のその語を開く経路になる (前の形の #/ も読める)', () => {
    expect(parseRoute('/kcna-dojo/glossary/pod/')).toEqual({ name: 'glossary', termId: 'pod' });
    expect(parseRoute('/kcna-dojo/glossary/')).toEqual({ name: 'glossary' });
    expect(parseRoute('#/glossary/pod')).toEqual({ name: 'glossary', termId: 'pod' });
  });
  it('カタカナの語は、漢字に続く複合語の一部にも当てない (等価ベースのベース)', () => {
    expect(links('等価ベースのセレクター').map((p) => p.text)).not.toContain('ベース');
  });
  it('用語集の詳しい説明では、その語自身 (名前・別名・名前の一部) をリンクにしない', () => {
    const argo = TERMS.find((t) => t.id === 'argo-cd')!;
    const flat = linkDetail(names, argo).flat();
    expect(flat.some((p) => typeof p !== 'string' && p.id === 'argo-cd')).toBe(false);
    // 「Argo CD」の中の CD はリンクにしない (ほかの所の CD は CD の語を指してよい)
    flat.forEach((p, i) => {
      if (typeof p !== 'string' && p.text === 'CD') expect(String(flat[i - 1] ?? '').endsWith('Argo ')).toBe(false);
    });
    const pss = TERMS.find((t) => t.id === 'pod-security-standards')!;
    const ids = linkDetail(names, pss).flat().filter((p) => typeof p !== 'string').map((p) => p.id);
    expect(ids).not.toContain('pod-security-standards');
    // 87 語のどれでも、自分へのリンクは出ない
    for (const t of TERMS) expect(linkDetail(names, t).flat().some((p) => typeof p !== 'string' && p.id === t.id), t.id).toBe(false);
  });
});
