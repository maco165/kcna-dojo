// 開いたときに読む画面 (最初の JS を軽くするため)。ホームとレッスンは本体に入れ、ほかはそれぞれの画面を開いたときに読む。
// ハンドブックと用語集のデータも、その画面の分と一緒に読まれる
import type { ComponentType } from 'react';
import type { Route } from './route';

const LOADERS = {
  exam: () => import('../screens/ExamScreen'),
  handbook: () => import('../screens/Handbook'),
  guide: () => import('../screens/Guide'),
  glossary: () => import('../screens/Glossary'),
  progress: () => import('../screens/ProgressScreen'),
  review: () => import('../screens/Review'),
  settings: () => import('../screens/Settings'),
  about: () => import('../screens/About'),
} as const;

export type LazyScreen = keyof typeof LOADERS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScreen = ComponentType<any>;

const loaded = new Map<LazyScreen, AnyScreen>();

export const isLazy = (name: Route['name']): name is LazyScreen => name in LOADERS;

/** 読み終えた画面の部品 (まだなら undefined) */
export const loadedScreen = (name: LazyScreen) => loaded.get(name);

/**
 * 画面の部品を読めなかったとき (回線が切れた・新しい版を出して古い部品が無くなった) は、ページごと読み直す。
 * 同じ URL で 2 回目も読めなければ false を返す (読み直しを繰り返さない)
 */
export function reloadOnce(): boolean {
  const key = `kcna.reload:${window.location.pathname}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** 画面の部品を読む (2 回目からはすぐ返る) */
export async function loadScreen(name: LazyScreen): Promise<AnyScreen> {
  const hit = loaded.get(name);
  if (hit) return hit;
  const mod = (await LOADERS[name]()) as { default: AnyScreen };
  loaded.set(name, mod.default);
  return mod.default;
}
