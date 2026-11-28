import { act, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
import { buildPages, renderPage, sitemap } from '../scripts/prerender.mjs';
import type { HandsOnChapter } from '../src/content/types';
import { WEEKS } from '../src/content/curriculum';
import { COVERED_LABS, FIRST_CHAPTER, handsOnLabel, COVERED_REST, chaptersOfLab, handsOnLinks, listedLabs } from '../src/content/coveredLabs';
import { HANDS_ON, NO_LABS, chapterTitle } from '../src/content/handsOn';
import ProgressScreen from '../src/screens/ProgressScreen';
import { summary } from '../src/screens/Settings';
import Home from '../src/screens/Home';
import { labsOf } from '../src/lib/lessonStatus';
import LessonScreen from '../src/screens/LessonScreen';
import { handsOnStepText } from '../src/lib/askAi';
import { canComplete, chapterStatus, guessOs, markedCount, stepsFor } from '../src/lib/handsOn';
import { completeHandsOn, completeLesson, emptyProgress, firstStudyDay, loadProgress, markHandsOnStep, mergeImported, planStart, normalizeProgress, parseProgressText, resetProgress, restartHandsOn, saveProgress, setProfile, type Progress } from '../src/lib/progress';
import { BASE, handsOnHref, parseRoute } from '../src/lib/route';
import { HandsOnIndex } from '../src/screens/HandsOn';
import { ChapterView } from '../src/screens/HandsOnChapter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 公開する章ではなく、テストだけの見本の章
const sample = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/hands-on/sample.json'), 'utf8')) as HandsOnChapter;
const at = new Date(2026, 10, 25, 12);
const ids = sample.steps.map((s) => s.id);

describe('経路', () => {
  it('一覧と章の URL', () => {
    expect(parseRoute(`${BASE}hands-on/`)).toEqual({ name: 'handsOn' });
    expect(parseRoute(handsOnHref('sample'))).toEqual({ name: 'handsOnChapter', chapterId: 'sample' });
    expect(chapterTitle('none')).toBe('実践');
    expect(chapterTitle('sample', [{ ...sample, short: '短い名前' }])).toBe('短い名前');
  });
});

describe('OS の出し分け', () => {
  it('ほかの OS だけの手順は出さず、完了の数にも入れない', () => {
    expect(stepsFor(sample.steps, 'mac').map((s) => s.id)).toEqual(['check-memory', 'install-mac', 'see-id']);
    expect(stepsFor(sample.steps, 'linux').map((s) => s.id)).toEqual(['check-memory', 'see-id']);
    const rec = { steps: ['check-memory', 'install-windows', 'gone'], at: '' };
    expect(markedCount(sample, rec, 'mac')).toEqual({ marked: 1, total: 3 });
    expect(markedCount(sample, rec, 'windows')).toEqual({ marked: 2, total: 3 });
  });
  it('端末から推す', () => {
    expect(guessOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(guessOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac');
    expect(guessOs('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
    expect(guessOs('Mozilla/5.0 (Linux; Android 15)')).toBe('windows');
    expect(guessOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('windows');
  });
});

describe('記録', () => {
  it('印は付け外しでき、同じ手順を 2 度付けても 1 つ', () => {
    let p = markHandsOnStep(emptyProgress(), 'sample', 'see-id', true, at);
    p = markHandsOnStep(p, 'sample', 'see-id', true, at);
    expect(p.handsOn!.sample.steps).toEqual(['see-id']);
    expect(markHandsOnStep(p, 'sample', 'see-id', false, at).handsOn!.sample.steps).toEqual([]);
    // 印を付けただけでは XP も連続日数も増えない
    expect(p.xp.total).toBe(0);
    expect(p.streak.count).toBe(0);
  });
  it('完了で XP が入る。押し直しでは入らず、印を消してもう一度やれば入る (旧い実習と同じ)', () => {
    let p = completeHandsOn(emptyProgress(), 'sample', 10, at);
    expect(p).toMatchObject({ xp: { total: 10 }, streak: { count: 1 }, handsOn: { sample: { done: true } } });
    expect(completeHandsOn(p, 'sample', 10, at)).toBe(p);
    p = restartHandsOn(p, 'sample', at);
    expect(p.handsOn!.sample).toMatchObject({ steps: [], done: true, redo: true });
    p = completeHandsOn(p, 'sample', 10, at);
    expect(p.xp.total).toBe(20);
    expect(p.handsOn!.sample.redo).toBeUndefined();
    // 章の完了は、問題演習のレッスンの記録に混ざらない
    expect(p.lessons).toEqual({});
  });
  it('前の版の記録 (handsOn の無い形) はそのまま読め、ほかの記録を変えない', () => {
    const old = {
      v: 1,
      streak: { count: 9, lastDay: '2026-11-24', freezes: 1, toNext: 2 },
      xp: { total: 36, byDay: { '2026-11-24': 36 } },
      lessons: { 'w1-l1': { done: true, best: 0.8, at: '2026-11-23T00:00:00.000Z' }, 'w1-lab': { done: true, best: 1, at: '2026-11-24T00:00:00.000Z' } },
      answers: { 'w1-l1-q1': { right: 1, wrong: 1, last: '2026-11-24T00:00:00.000Z' } },
      handbook: { 'core-concepts': { seen: 3, at: '' } },
      profile: { dailyGoalXp: 20, examDate: '2027-01-30' },
    };
    const store = new Map([['kcna.v1', JSON.stringify(old)]]);
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const p = loadProgress(storage);
    expect(p).toEqual(old);
    // 章の印を足して保存しても、前の記録はそのまま残る
    expect(saveProgress(markHandsOnStep(p, 'sample', 'see-id', true, at), storage)).toBe(true);
    const again = loadProgress(storage);
    expect(again).toEqual({ ...old, handsOn: { sample: { steps: ['see-id'], at: at.toISOString() } } });
    // この欄を知らない版の形にしても、知っている欄は同じ
    const { handsOn: _h, ...rest } = again;
    expect(rest).toEqual(old);
  });
  it('書き出しと読み込みで、印・完了・OS が残る', () => {
    let p = markHandsOnStep(emptyProgress(), 'sample', 'see-id', true, at);
    p = restartHandsOn(completeHandsOn(p, 'sample', 10, at), 'sample', at);
    p = setProfile(markHandsOnStep(p, 'other', 'a', true, at), { os: 'mac' });
    expect(parseProgressText(JSON.stringify(p))).toEqual(p);
  });
  it('記録を消すと章の印と完了が消え、OS の設定は残る', () => {
    const p = setProfile(completeHandsOn(emptyProgress(), 'sample', 10, at), { os: 'linux' });
    const r = resetProgress(p);
    expect(r.handsOn).toBeUndefined();
    expect(r.profile?.os).toBe('linux');
  });
  it('壊れた形は捨て、画面を落とさない', () => {
    const read = (handsOn: unknown) => normalizeProgress({ v: 1, handsOn })!.handsOn;
    expect(read('x')).toBeUndefined();
    expect(read({ sample: 1, a: { steps: 'x' }, b: { steps: [] }, '../c': { steps: ['x'] } })).toBeUndefined();
    expect(read({ sample: { steps: ['ok', 1, 'ok', 'NG id'], done: 'yes', at: 3 } })).toEqual({ sample: { steps: ['ok'], at: '' } });
    expect(read({ sample: { steps: ['ok'], at: '', later: 1 } })).toEqual({ sample: { steps: ['ok'], at: '', later: 1 } });
    expect(normalizeProgress({ v: 1, profile: { os: 'bsd' } })!.profile!.os).toBeUndefined();
  });
  it('手順の印は、問題演習の計画の開始日 (初めて学んだ日) を動かさない。章の完了は、実習の完了と同じく学んだ日に入る', () => {
    const marked = markHandsOnStep(emptyProgress(), 'sample', 'see-id', true, at);
    expect(firstStudyDay(marked)).toBeNull();
    expect(planStart(marked, new Date(2026, 11, 1))).toBe('2026-12-01');
    const lab = completeLesson(emptyProgress(), 'w1-lab', { correct: 1, total: 1 }, 10, at);
    expect(firstStudyDay(completeHandsOn(emptyProgress(), 'sample', 10, at))).toBe(firstStudyDay(lab));
  });
  it('読み込み: 実践の OS は読み込んだ値、無ければ今の値。画面の色は今の端末の値', () => {
    const now = setProfile(emptyProgress(), { os: 'mac', colorMode: 'dark' });
    const file = setProfile(emptyProgress(), { examDate: '2027-01-30' });
    expect(mergeImported(file, now).profile).toMatchObject({ os: 'mac', colorMode: 'dark', examDate: '2027-01-30' });
    expect(mergeImported(setProfile(file, { os: 'linux' }), now).profile!.os).toBe('linux');
    expect(mergeImported(emptyProgress(), now).profile).toMatchObject({ os: 'mac', colorMode: 'dark' });
    expect(mergeImported(emptyProgress(), emptyProgress()).profile).toBeUndefined();
  });
  it('する手順が 0 件なら、完了にできない', () => {
    expect(canComplete({ marked: 0, total: 0 })).toBe(false);
    expect(canComplete({ marked: 2, total: 3 })).toBe(false);
    expect(canComplete({ marked: 3, total: 3 })).toBe(true);
  });
  it('一覧の状態', () => {
    const p = emptyProgress();
    expect(chapterStatus(sample, p, 'mac')).toEqual({ done: false, text: '未着手' });
    expect(chapterStatus(sample, markHandsOnStep(p, 'sample', 'see-id', true, at), 'mac')).toEqual({ done: false, text: '途中 1 / 3 手順' });
    expect(chapterStatus(sample, completeHandsOn(p, 'sample', 10, at), 'mac')).toEqual({ done: true, text: '完了' });
  });
});

it('AI に渡す文に、章・手順・打つ場所・コードを入れる', () => {
  const t = handsOnStepText(sample.title, sample.steps[3], 2, 'Mac');
  for (const x of [sample.title, '手順 3', '仮想マシンの中', 'PC: Mac', 'sudo id -u']) expect(t).toContain(x);
});

// 負荷が高いと 5 秒を超えることがある (章の画面は部品が多い)
describe('画面', { timeout: 30_000 }, () => {
  const mounted: (() => void)[] = [];
  afterEach(() => {
    mounted.splice(0).forEach((f) => f());
    document.body.innerHTML = '';
  });
  async function show(node: ReactNode) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(node));
    mounted.push(() => act(() => root.unmount()));
    return el;
  }
  async function mount(start: Progress, chapter: HandsOnChapter = sample) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    let current = start;
    function Host() {
      const [p, set] = useState(start);
      current = p;
      return <ChapterView chapter={chapter} chapters={[chapter]} progress={p} updateProgress={(fn) => set(fn)} />;
    }
    await act(async () => root.render(<Host />));
    mounted.push(() => act(() => root.unmount()));
    const finish = () => [...el.querySelectorAll('button')].find((b) => /完了にする/.test(b.textContent ?? ''))!;
    const disabled = () => finish().disabled || finish().getAttribute('aria-disabled') === 'true';
    const boxes = () => [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    return { el, finish, disabled, boxes, progress: () => current };
  }
  const macUser = () => setProfile(emptyProgress(), { os: 'mac' });

  it('選んだ OS の手順だけを出し、全部に印を付けると完了にできる', async () => {
    const v = await mount(macUser());
    expect(v.el.textContent).toContain('brew install');
    expect(v.el.textContent).not.toContain('winget install Canonical');
    expect(v.boxes()).toHaveLength(3);
    expect(v.disabled()).toBe(true);
    for (const b of v.boxes()) await act(async () => b.click());
    expect(v.progress().handsOn!.sample.steps).toEqual(['check-memory', 'install-mac', 'see-id']);
    expect(v.disabled()).toBe(false);
    await act(async () => v.finish().click());
    expect(v.progress()).toMatchObject({ xp: { total: 10 }, handsOn: { sample: { done: true } } });
    expect(v.progress().handsOn!.sample.steps.every((s) => ids.includes(s))).toBe(true);
  });
  it('OS を選び直すと、手順と、完了にできるかが替わる', async () => {
    const v = await mount(macUser());
    const pick = async (label: string) => {
      const radio = [...v.el.querySelectorAll<HTMLElement>('[role="radio"], input[type="radio"]')].find((r) => (r.textContent || r.getAttribute('aria-label') || r.closest('label')?.textContent) === label)!;
      await act(async () => radio.click());
    };
    // Linux の手順 (OS の無い 2 つ) だけに印を付けると、Mac では足りず、Linux では完了にできる
    await act(async () => v.boxes()[0].click());
    await act(async () => v.boxes()[2].click());
    expect(v.disabled()).toBe(true);
    await pick('Linux');
    expect(v.progress().profile!.os).toBe('linux');
    expect(v.boxes()).toHaveLength(2);
    expect(v.el.textContent).not.toContain('brew install');
    expect(v.disabled()).toBe(false);
    await pick('Windows');
    expect(v.boxes()).toHaveLength(3);
    expect(v.el.textContent).toContain('winget install');
    expect(v.disabled()).toBe(true);
  });
  it('完了のボタンは消え、印は、確かめてからでないと消えない', async () => {
    // jsdom の dialog には showModal / close が無い
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
    const v = await mount(macUser());
    for (const b of v.boxes()) await act(async () => b.click());
    const complete = v.finish();
    await act(async () => complete.click());
    // 同じ要素が「もう一度やる」に替わらない (二度押ししても印は残る)
    expect(complete.isConnected).toBe(false);
    await act(async () => complete.click());
    expect(v.progress().handsOn!.sample.steps).toHaveLength(3);
    expect(document.activeElement?.textContent).toContain('完了しました');
    const button = (re: RegExp) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent ?? ''))!;
    await act(async () => button(/もう一度やる/).click());
    expect(v.progress().handsOn!.sample.steps).toHaveLength(3);
    await act(async () => button(/^印を消す$/).click());
    expect(v.progress().handsOn!.sample).toMatchObject({ steps: [], done: true, redo: true });
    expect(document.activeElement?.id).toBe('ho-steps');
    expect(v.progress().xp.total).toBe(10);
  });
  it('する手順が 1 つも無い章は、完了にできない', async () => {
    const v = await mount(macUser(), { ...sample, steps: sample.steps.filter((s) => s.os === 'windows') });
    expect(v.boxes()).toHaveLength(0);
    expect(v.disabled()).toBe(true);
  });
  it('同じ行が 2 回ある手順でも、行の意味を全部出す', async () => {
    const s = { ...sample.steps[3], lines: [{ code: 'id -u', text: '1 回目' }, { code: 'id -u', text: '2 回目' }] };
    const v = await mount(macUser(), { ...sample, steps: [s] });
    expect([...v.el.querySelectorAll('.hb-lines dd')].map((x) => x.textContent)).toEqual(['1 回目', '2 回目']);
  });
  it('途中で閉じても、開き直すと印が残っている', async () => {
    const v = await mount(markHandsOnStep(macUser(), 'sample', 'install-mac', true, at));
    expect(v.boxes().map((b) => b.checked)).toEqual([false, true, false]);
  });
  it('手順には、なぜ・意味・出力・読み方・つまずいた時・出典・未確認の表示を出す。課題の答えは折りたたむ', async () => {
    const v = await mount(macUser());
    const s = sample.steps[3];
    for (const x of [s.why, s.output!, s.read!, s.lines![1].text, s.trouble![0].fix, sample.steps[2].unverified!, '実機で未確認']) expect(v.el.textContent).toContain(x);
    expect([...v.el.querySelectorAll('details')].find((d) => d.querySelector('summary')?.textContent === '答え')!.open).toBe(false);
    // 行の中のコマンドはコマンドのページへ
    expect(v.el.querySelector(`a.hb-cmd[href="${BASE}commands/id/"]`)).not.toBeNull();
    expect(v.el.querySelector(`a[href="${BASE}handbook/containerization/"]`)).not.toBeNull();
  });
  it('章が覆った実習は一覧から外し、ページには章へのリンクを出す。覆う章と実習は実在する', async () => {
    const labs = WEEKS.flatMap(labsOf).map((l) => l.id);
    expect(FIRST_CHAPTER).toEqual((({ id, order, title }) => ({ id, order, title }))(HANDS_ON[0]));
    for (const [lab, chapters] of Object.entries(COVERED_LABS)) {
      expect(labs).toContain(lab);
      // 番号と題は、章のデータと同じ。並びは章の番号の順
      expect(chapters).toEqual(chapters.map((r) => HANDS_ON.find((c) => c.id === r.id)).map((c) => ({ id: c?.id, order: c?.order, title: c?.title })));
      expect(chapters.map((c) => c.order)).toEqual(chapters.map((c) => c.order).sort((a, b) => a - b));
    }
    expect(chaptersOfLab('w6-lab').map((c) => c.id)).toEqual(['storage', 'security-troubleshoot']);
    expect(chaptersOfLab('no-such-lab')).toEqual([]);
    // 8 週の実習を全部、章が覆った
    expect(listedLabs(WEEKS)).toEqual([]);
    const week2 = JSON.parse(readFileSync(path.resolve(process.cwd(), 'src/content/week2.json'), 'utf8'));
    const lesson = week2.lessons.find((l: { id: string }) => l.id === 'w2-lab');
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    mounted.push(() => act(() => root.unmount()));
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    await act(async () => root.render(<LessonScreen lesson={lesson} week={2} progress={emptyProgress()} updateProgress={() => {}} />));
    expect([...el.querySelectorAll(`a[href^="${BASE}hands-on/"]`)].map((a) => a.getAttribute('href')).filter((h) => h !== `${BASE}hands-on/`)).toEqual([`${BASE}hands-on/install-k3s/`, `${BASE}hands-on/self-healing/`]);
    expect(Object.keys(COVERED_REST)).toEqual(['w2-lab', 'w5-lab']);
    expect(el.textContent).toContain(COVERED_REST['w2-lab']);
    // 終えたあとの結果の画面にも、同じ章へのリンク
    for (const b of el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) await act(async () => b.click());
    await act(async () => [...el.querySelectorAll('button')].find((b) => b.textContent === '完了にする')!.click());
    expect(el.textContent).toContain('レッスン完了');
    expect([...el.querySelectorAll(`a[href^="${BASE}hands-on/"]`)].map((x) => x.getAttribute('href')).filter((h) => h !== `${BASE}hands-on/`)).toEqual([`${BASE}hands-on/install-k3s/`, `${BASE}hands-on/self-healing/`]);
    vi.unstubAllGlobals();
  });
  it('週の画面の「動かして確かめる」は、覆われた週では章へ、ほかの週では実習へ送る', async () => {
    const paths = (w: number) => handsOnLinks(WEEKS[w - 1]).map((l) => l.path);
    expect(paths(1)).toEqual(['hands-on/vm-setup/', 'hands-on/run-containers/']);
    expect(paths(2)).toEqual(['hands-on/vm-setup/', 'hands-on/install-k3s/', 'hands-on/self-healing/']);
    expect(WEEKS.map((w) => handsOnLabel(w).includes('0 章から順に'))).toEqual(WEEKS.map(() => true));
    expect(paths(3)).toEqual(['hands-on/vm-setup/', 'hands-on/rollout/', 'hands-on/batch/']);
    expect(paths(6)).toEqual(['hands-on/vm-setup/', 'hands-on/storage/', 'hands-on/security-troubleshoot/']);
    expect(paths(7)).toEqual(['hands-on/vm-setup/', 'hands-on/deliver-observe/']);
    expect(paths(8)).toEqual(['hands-on/vm-setup/', 'hands-on/deliver-observe/']);
    expect(paths(4)).toEqual(['hands-on/vm-setup/', 'hands-on/scaling/']);
    expect(paths(5)).toEqual(['hands-on/vm-setup/', 'hands-on/networking/']);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    for (const w of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const el = await show(<Home week={w} progress={emptyProgress()} />);
      expect([...el.querySelectorAll('nav[aria-label="この週の実践"] a')].map((x) => x.getAttribute('href'))).toEqual([...paths(w), 'hands-on/'].map((x) => `${BASE}${x}`));
    }
    vi.unstubAllGlobals();
  });
  it('章が全部の実習を覆ったので、進捗に週ごとの実習の n / m を出さない。設定の「完了した実践」には記録のとおり数える', async () => {
    const done = { done: true as const, best: 1, at: '' };
    const p = completeHandsOn({ ...emptyProgress(), lessons: { 'w1-lab': done, 'w6-lab': done, 'w1-l1': done } }, 'run-containers', 10, at);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    const el = await show(<ProgressScreen progress={p} />);
    const row = (name: string) => [...el.querySelectorAll('li')].find((x) => x.textContent?.startsWith(name))!.textContent;
    expect([...el.querySelectorAll('li')].some((x) => x.textContent?.startsWith('週ごとの実習'))).toBe(false);
    expect(row('章')).toBe(`章1 / ${HANDS_ON.length}`);
    expect(summary(p)).toContain('完了したレッスン 1 · 完了した実践 3 ·');
    vi.unstubAllGlobals();
  });
  it('一覧は、章と旧い実習の完了を別々に数える。章が無くても、覆っていない実習が無くても壊れない', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    mounted.push(() => act(() => root.unmount()));
    const p = completeHandsOn({ ...emptyProgress(), lessons: { 'w1-lab': { done: true, best: 1, at: '' }, 'w6-lab': { done: true, best: 1, at: '' }, 'w1-l1': { done: true, best: 1, at: '' } } }, 'sample', 10, at);
    // 覆っていない実習があったときの数え方は、w6〜w8 の実習を渡して見る
    const some = WEEKS.flatMap((w) => labsOf(w).map((lab) => ({ lab, week: w.week }))).filter((x) => x.week >= 6);
    await act(async () => root.render(<HandsOnIndex progress={p} chapters={[sample]} labs={some} />));
    const counts = () => [...el.querySelectorAll('h2 .hb-muted')].map((x) => x.textContent);
    expect(counts()).toEqual(['1 / 1 完了', '1 / 3 完了']);
    expect(el.querySelectorAll(`a.cmp-card[href^="${BASE}lesson/w"]`)).toHaveLength(3);
    expect(el.querySelector(`a.cmp-card[href="${BASE}hands-on/sample/"]`)).not.toBeNull();
    expect([...el.querySelectorAll('p a')].map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining([`${BASE}lesson/w2-lab/`, `${BASE}lesson/w5-lab/`]));
    await act(async () => root.render(<HandsOnIndex progress={p} chapters={[]} labs={some} />));
    expect(counts()).toEqual(['1 / 3 完了']);
    expect(el.textContent).toContain('章は準備中です');
    // 今の中身 (全部覆った) では、実習の数と並びを出さず、その旨と残る実習へのリンクだけを出す
    await act(async () => root.render(<HandsOnIndex progress={p} chapters={[sample]} />));
    expect(counts()).toEqual(['1 / 1 完了']);
    expect(el.querySelectorAll(`a.cmp-card[href^="${BASE}lesson/w"]`)).toHaveLength(0);
    expect(el.textContent).toContain(NO_LABS);
    expect([...el.querySelectorAll('p a')].map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining([`${BASE}lesson/w2-lab/`, `${BASE}lesson/w5-lab/`]));
  });
});

describe('書き出す HTML', { timeout: 60_000 }, () => {
  let pages: { path: string; title: string; parent?: string }[] = [];
  let doc: Document;
  beforeAll(async () => {
    pages = await buildPages((m: string) => import(/* @vite-ignore */ path.join(process.cwd(), m)), { chapters: [sample] });
    const html = renderPage(readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8'), pages.find((p) => p.path === 'hands-on/sample/'));
    doc = new DOMParser().parseFromString(html, 'text/html');
  }, 60_000);
  it('章が覆った実習は、書き出した一覧に並べず、実習のページから章へつなぐ', () => {
    const body = (p: string) => new DOMParser().parseFromString(renderPage(readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8'), pages.find((x) => x.path === p)), 'text/html');
    const hrefs = [...body('hands-on/').querySelectorAll('#root a')].map((a) => a.getAttribute('href')).filter((h) => h!.includes('-lab/'));
    // 全部の実習を章が覆ったので、残るのは一覧の説明の「この実習も役に立ちます」の w2-lab と w5-lab だけ
    expect(hrefs).toEqual([2, 5].map((w) => `${BASE}lesson/w${w}-lab/`));
    expect(body('hands-on/').querySelector('#root')!.textContent).toContain(NO_LABS);
    expect([...body('hands-on/').querySelectorAll('#root ul')].filter((u) => u.children.length === 0)).toHaveLength(0);
    expect(body('lesson/w2-lab/').querySelector('#root')!.textContent).toContain(COVERED_REST['w2-lab']);
    expect(body('lesson/w5-lab/').querySelector('#root')!.textContent).toContain(COVERED_REST['w5-lab']);
    expect(body('hands-on/').querySelector('#root')!.textContent).toContain('クラスターの外の機械から試したい人は、この実習も役に立ちます:');
    expect(body('lesson/w1-lab/').querySelector('#root')!.textContent).not.toContain('複数のノードがある人');
    expect(body('lesson/w1-lab/').querySelector(`#root a[href="${BASE}hands-on/run-containers/"]`)).not.toBeNull();
    expect(body('lesson/w4-lab/').querySelector(`#root a[href="${BASE}hands-on/scaling/"]`)).not.toBeNull();
    expect(body('lesson/w5-lab/').querySelector(`#root a[href="${BASE}hands-on/networking/"]`)).not.toBeNull();
    expect(body('lesson/w3-lab/').querySelector(`#root a[href="${BASE}hands-on/batch/"]`)).not.toBeNull();
  });
  it('全部の OS の手順・意味・出力・つまずいた時・課題を書く', () => {
    const text = doc.querySelector('#root')!.textContent!;
    for (const s of sample.steps) {
      for (const x of [s.text, s.why, s.code?.text, s.output, s.read, s.unverified, ...(s.lines ?? []).map((l) => l.text), ...(s.trouble ?? []).flatMap((t) => [t.symptom, t.check, t.fix])]) if (x) expect(text).toContain(x);
    }
    for (const x of Object.values(sample.challenges[0])) expect(text).toContain(x);
    expect([...doc.querySelectorAll('#root a')].map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining([`${BASE}commands/sudo/`, `${BASE}handbook/containerization/`]));
  });
  it('題名・canonical・パンくず・構造化データ・sitemap', () => {
    expect(doc.title).toBe(`${sample.title} | クラネイ`);
    const url = 'https://maco165.github.io/kcna-dojo/hands-on/sample/';
    expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(url);
    expect([...doc.querySelectorAll('#root nav a')].map((a) => a.getAttribute('href'))).toEqual([BASE, `${BASE}hands-on/`]);
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'];
    expect(ld.map((x: { '@type': string }) => x['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(ld[0]).toMatchObject({ headline: sample.title, url });
    expect(sitemap(pages)).toContain(`<loc>${url}</loc>`);
  });
});
