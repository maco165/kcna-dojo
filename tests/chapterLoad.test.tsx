import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 章の本文の読み込みだけを差し替え、届く順番と失敗を決める (ほかの部品は本物)
type Job = { resolve: () => void; reject: () => void };
const jobs = new Map<string, Job>();
const ready = new Set<string>();
const reloadOnce = vi.fn(() => true);
vi.mock('../src/lib/screens', () => ({
  isLazy: (name: string) => name === 'handsOnChapter',
  loadedScreen: (r: { chapterId: string }) => (ready.has(r.chapterId) ? ({ chapterId }: { chapterId: string }) => <h1>{chapterId}</h1> : undefined),
  loadScreen: (r: { chapterId: string }) =>
    new Promise<void>((ok, ng) => jobs.set(r.chapterId, { resolve: () => (ready.add(r.chapterId), ok()), reject: () => ng(new Error('404')) })),
  reloadOnce: () => reloadOnce(),
}));
const { default: App } = await import('../src/App');
const BASE = '/kcna-dojo/';

describe('章から章へ移るときの読み込み', { timeout: 30_000 }, () => {
  let root: Root;
  let el: HTMLElement;
  const go = (id: string) =>
    act(async () => {
      history.pushState(null, '', `${BASE}hands-on/${id}/`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  const settle = (id: string, how: 'resolve' | 'reject') => act(async () => jobs.get(id)![how]());
  const shown = () => el.querySelector('h1')?.textContent;
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    window.scrollTo = () => {};
    jobs.clear();
    ready.clear();
    ready.add('a');
    reloadOnce.mockReset().mockReturnValue(true);
    history.replaceState(null, '', `${BASE}hands-on/a/`);
    el = document.body.appendChild(document.createElement('div'));
    root = createRoot(el);
    await act(async () => root.render(<App />));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('読み終えるまで前の章を出し、読み終えたら替える', async () => {
    await go('b');
    expect(shown()).toBe('a');
    expect(document.documentElement.dataset.loading).toBe('true');
    await settle('b', 'resolve');
    expect(shown()).toBe('b');
    expect(document.documentElement.dataset.loading).toBeUndefined();
  });
  it('続けて移ったとき、古い章が後から来ても替わらない (失敗しても読み直さない)', async () => {
    await go('b');
    await go('c');
    expect(jobs.has('c')).toBe(true);
    await settle('c', 'resolve');
    expect(shown()).toBe('c');
    await settle('b', 'resolve');
    expect(shown()).toBe('c');
    await go('d');
    await go('e');
    await settle('d', 'reject');
    expect(reloadOnce).not.toHaveBeenCalled();
    await settle('e', 'resolve');
    expect(shown()).toBe('e');
  });
  it('古い章だけが先に届いても、今の章を待つ', async () => {
    await go('b');
    await go('c');
    await settle('b', 'resolve');
    expect(shown()).toBe('a');
    await settle('c', 'resolve');
    expect(shown()).toBe('c');
  });
  it('読めなければページごと読み直す。2 回目も読めなければ、読み直しを出し、別のページへは移れる', async () => {
    await go('b');
    await settle('b', 'reject');
    expect(reloadOnce).toHaveBeenCalledTimes(1);
    expect(shown()).toBe('a');
    reloadOnce.mockReturnValue(false);
    await go('c');
    await settle('c', 'reject');
    expect(el.textContent).toContain('画面を読み込めませんでした');
    expect(document.documentElement.dataset.loading).toBeUndefined();
    await go('a');
    expect(shown()).toBe('a');
    // もう一度開くと読み直し、読めれば出す
    await go('c');
    await settle('c', 'resolve');
    expect(shown()).toBe('c');
  });
});

describe('章の本文の入口', () => {
  it('開いた章だけを読む。知らない id は読むものが無く、描ける', async () => {
    const m = await import('../src/content/handsOnChapters');
    const s = await import('../src/screens/HandsOnChapter');
    const route = (chapterId: string) => ({ name: 'handsOnChapter', chapterId }) as const;
    expect(s.isReady(route('install-k3s'))).toBe(false);
    await s.prepare(route('install-k3s'));
    expect(m.loadedChapter('install-k3s')?.id).toBe('install-k3s');
    expect(s.isReady(route('install-k3s'))).toBe(true);
    expect(m.loadedChapter('vm-setup')).toBeUndefined();
    expect(s.isReady(route('vm-setup'))).toBe(false);
    await s.prepare(route('no-such'));
    expect(s.isReady(route('no-such'))).toBe(true);
    expect(m.isChapter('constructor')).toBe(false);
  });
  it('全部の章が、軽い一覧の id から読める (書き出しの入口と同じ中身)', async () => {
    const { HANDS_ON_CHAPTERS } = await import('../src/content/handsOnAll');
    const m = await import('../src/content/handsOnChapters');
    for (const c of HANDS_ON_CHAPTERS) {
      await m.loadChapter(c.id);
      expect(m.loadedChapter(c.id)).toEqual(c);
    }
  });
  it('画面のコードは、全章を読む入口を取り込まず、章を eager で読まない', () => {
    const files = readdirSync(path.join(process.cwd(), 'src'), { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f));
    const read = (f: string) => readFileSync(path.join(process.cwd(), 'src', f), 'utf8');
    expect(files.filter((f) => /from '[^']*handsOnAll'|import\('[^']*handsOnAll'\)/.test(read(f)))).toEqual([]);
    const eager = files.filter((f) => !f.endsWith('handsOnAll.ts') && [...read(f).matchAll(/import\.meta\.glob[^;]*hands-on[^;]*;/g)].some((g) => /eager: true/.test(g[0]) && !/query: '\?meta'/.test(g[0])));
    expect(eager).toEqual([]);
  });
});

describe('戻るの位置', () => {
  it('閉じた確かめの窓の中の欄は、スクロールする欄とみなさない (スマホの章・設定・模擬試験)', async () => {
    const { scroller } = await import('../src/lib/scrollMemory');
    document.body.innerHTML = '<dialog><div class="astryx-layout-content"></div></dialog>';
    expect(scroller()).toBe(document.scrollingElement ?? document.documentElement);
    document.body.innerHTML += '<div class="astryx-layout-content" id="main"></div>';
    expect(scroller().id).toBe('main');
    document.body.innerHTML = '';
  });
  it('読んでいる間は前のページの位置を動かさず、描き終えてから戻す', async () => {
    vi.resetModules();
    sessionStorage.setItem('kcna.scroll', JSON.stringify({ k1: 500 }));
    const { onRouteChanged, retryRestore, scroller } = await import('../src/lib/scrollMemory');
    history.replaceState({ kcnaKey: 'k1' }, '');
    const frame = () => new Promise((r) => setTimeout(r, 60));
    document.documentElement.dataset.loading = 'true';
    scroller().scrollTop = 0;
    onRouteChanged();
    await frame();
    expect(scroller().scrollTop).toBe(0);
    delete document.documentElement.dataset.loading;
    retryRestore();
    await frame();
    expect(scroller().scrollTop).toBe(500);
  });
});
