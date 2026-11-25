// 開いたときに読む画面 (最初の JS を軽くするため)。ホームは本体に入れ、ほかはそれぞれの画面を開いたときに読む。
// ハンドブックと用語集のデータも、その画面の分と一緒に読まれる。レッスンは問題の全文 (content/lessons.ts) と一緒に読む。
// 実践の章は、画面の部品のあとに、開いた章の本文だけを読む (部品の isReady と prepare)
import type { ComponentType } from 'react';
import type { Route } from './route';

const LOADERS = {
  lesson: () => import('../screens/LessonRoute'),
  exam: () => import('../screens/ExamScreen'),
  handbook: () => import('../screens/Handbook'),
  guide: () => import('../screens/Guide'),
  glossary: () => import('../screens/Glossary'),
  compare: () => import('../screens/Compare'),
  commands: () => import('../screens/Commands'),
  handsOn: () => import('../screens/HandsOn'),
  handsOnChapter: () => import('../screens/HandsOnChapter'),
  progress: () => import('../screens/ProgressScreen'),
  review: () => import('../screens/Review'),
  settings: () => import('../screens/Settings'),
  about: () => import('../screens/About'),
} as const;

export type LazyScreen = keyof typeof LOADERS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScreen = ComponentType<any>;

/** 画面の部品。isReady と prepare は、開いた URL ごとに読むデータがある画面 (実践の章) だけが持つ */
export type ScreenModule = { default: AnyScreen; isReady?: (route: Route) => boolean; prepare?: (route: Route) => Promise<void> };
const loaded = new Map<LazyScreen, ScreenModule>();

export const isLazy = (name: Route['name']): name is LazyScreen => name in LOADERS;

/** 読み終えた画面の部品 (部品か、その URL のデータをまだ読んでいなければ undefined) */
export function loadedScreen(route: Route): AnyScreen | undefined {
  const mod = isLazy(route.name) ? loaded.get(route.name) : undefined;
  return mod && (mod.isReady?.(route) ?? true) ? mod.default : undefined;
}

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

/** 画面の部品と、その URL のデータを読む (2 回目からはすぐ返る) */
export async function loadScreen(route: Route): Promise<void> {
  if (!isLazy(route.name)) return;
  let mod = loaded.get(route.name);
  if (!mod) {
    mod = (await LOADERS[route.name]()) as ScreenModule;
    loaded.set(route.name, mod);
  }
  await mod.prepare?.(route);
}
