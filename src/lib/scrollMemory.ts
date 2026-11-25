// 戻る・進む操作で、そのページを離れたときのスクロールの位置に戻す。
// 履歴の 1 件ごとに鍵 (history.state.kcnaKey) を付け、鍵ごとの位置を覚える。
// 鍵の無い履歴は新しく開いたページなので先頭から出す
const STORE = 'kcna.scroll';

function readStore(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** 主の置き場はこの Map。sessionStorage は再読み込みに備えた写し (使えなくても同じ画面の中では戻せる) */
const positions = new Map<string, number>(Object.entries(readStore()));

function writeStore() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // 保存できなくても画面は動かす (プライベートモードなど)
  }
}

/** PC は AppShell の中の欄、スマホはページがスクロールする。確かめの窓 (AlertDialog) も同じクラスの欄を持ち、閉じていても DOM にあるので除く */
export function scroller(): Element {
  return [...document.querySelectorAll('.astryx-layout-content')].find((e) => !e.closest('dialog')) ?? document.scrollingElement ?? document.documentElement;
}

const newKey = () => Math.random().toString(36).slice(2, 10);

/** 今の履歴の鍵。無ければ付ける。付けたなら fresh=true (新しく開いたページ) */
export function ensureKey(): { key: string; fresh: boolean } {
  const state = (history.state ?? {}) as { kcnaKey?: string };
  if (state.kcnaKey) return { key: state.kcnaKey, fresh: false };
  const key = newKey();
  history.replaceState({ ...state, kcnaKey: key }, '');
  return { key, fresh: true };
}

let current = '';
let started = false;
let lastFresh = true;

/** 今のページが新しく開いたページか (戻る・進むで来たのではないか)。ページの中で特定の場所へ送るかを決めるのに使う */
export const isFreshVisit = () => lastFresh;

/** 今のページの位置を覚える。ページを離れる直前 (前の画面がまだあるうち) と、閉じる・再読み込みの前に呼ぶ */
export function savePosition() {
  if (!current) return;
  positions.set(current, scroller().scrollTop);
  writeStore();
}

/** 戻したい位置 (まだ戻せていなければ残る)。開いたときに読む画面は、描き終えたときに retryRestore でもう一度試す */
let pending: number | null = null;

/** 画面が描かれるのを待ってから位置を戻す (長いページは描き終わるまで高さが足りない)。1 秒まで試す */
function restore(top: number, until = performance.now() + 1000) {
  pending = top;
  requestAnimationFrame(() => {
    if (pending !== top) return;
    // 開いたページをまだ読んでいて、前のページの画面が出ている間は動かさない (前のページの位置を動かして、戻した扱いにしない)。描き終えたら retryRestore が続ける
    if (document.documentElement.dataset.loading) return;
    const el = scroller();
    el.scrollTop = top;
    if (Math.abs(el.scrollTop - top) <= 2) pending = null;
    else if (performance.now() < until) restore(top, until);
  });
}

/** 開いたときに読む画面を描き終えたら呼ぶ。読み込みに 1 秒以上かかって戻せなかった位置を、もう一度戻す */
export function retryRestore() {
  if (pending !== null) restore(pending);
}

/** 起動のときに呼ぶ (2 回呼ばれても 1 回だけ働く) */
export function startScrollMemory() {
  if (started) return;
  started = true;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const k = ensureKey();
  current = k.key;
  lastFresh = k.fresh;
  window.addEventListener('pagehide', savePosition);
  // 別のページ (外のサイトや、書き出した別の HTML) から戻る・進むで来たときも、覚えた位置に戻す
  if (!k.fresh && positions.has(k.key)) restore(positions.get(k.key)!);
}

/** 経路が変わったあとに呼ぶ。戻る・進むなら元の位置へ、新しいページなら先頭へ */
export function onRouteChanged() {
  const { key, fresh } = ensureKey();
  current = key;
  lastFresh = fresh;
  if (fresh) {
    pending = null;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => (scroller().scrollTop = 0));
    return;
  }
  restore(positions.get(key) ?? 0);
}
