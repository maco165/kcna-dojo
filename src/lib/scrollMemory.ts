// 戻る・進む操作で、そのページを離れたときのスクロールの位置に戻す。
// 履歴の 1 件ごとに鍵 (history.state.kcnaKey) を付け、鍵ごとの位置を sessionStorage に残す。
// 鍵の無い履歴は新しく開いたページなので先頭から出す
const STORE = 'kcna.scroll';

type Positions = Record<string, number>;

function read(): Positions {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Positions;
  } catch {
    return {};
  }
}

function write(p: Positions) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    // 保存できなくても画面は動かす (プライベートモードなど)
  }
}

/** PC は AppShell の中の欄、スマホはページがスクロールする */
export function scroller(): Element {
  return document.querySelector('.astryx-layout-content') ?? document.scrollingElement ?? document.documentElement;
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
let saving = 0;

function save() {
  if (!current) return;
  const p = read();
  p[current] = scroller().scrollTop;
  write(p);
}

/** 画面が描かれるのを待ってから位置を戻す (長いページは描き終わるまで高さが足りない) */
function restore(top: number, tries = 20) {
  requestAnimationFrame(() => {
    const el = scroller();
    el.scrollTop = top;
    if (Math.abs(el.scrollTop - top) > 2 && tries > 0) restore(top, tries - 1);
  });
}

/** 起動のときに 1 回だけ呼ぶ */
export function startScrollMemory() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  current = ensureKey().key;
  // 中の欄のスクロールも拾うため、capture で受ける
  document.addEventListener(
    'scroll',
    () => {
      if (saving) return;
      saving = requestAnimationFrame(() => {
        saving = 0;
        save();
      });
    },
    { capture: true, passive: true },
  );
}

/** 経路が変わったときに呼ぶ。戻る・進むなら元の位置へ、新しいページなら先頭へ */
export function onRouteChanged() {
  const { key, fresh } = ensureKey();
  current = key;
  if (fresh) {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => (scroller().scrollTop = 0));
    return;
  }
  restore(read()[key] ?? 0);
}
