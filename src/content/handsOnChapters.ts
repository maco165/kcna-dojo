// 実践の章の全文を、開いた章の分だけ読む (章ごとに 1 チャンク)。一覧・前後の章・題名は handsOn.ts の軽い形を使う
import { HANDS_ON_FILES } from './handsOn';
import type { HandsOnChapter } from './types';

const FILES = import.meta.glob<HandsOnChapter>('./hands-on/*.json', { import: 'default' });
const loaded = new Map<string, HandsOnChapter>();

/** ある章の id か */
export const isChapter = (id: string) => HANDS_ON_FILES.has(id);

/** 読み終えた章 (まだなら undefined) */
export const loadedChapter = (id: string) => loaded.get(id);

/** 章を読む。知らない id なら何もしない (画面が「見つかりませんでした」を出す)。読めなければ投げる (次に呼ばれたときにもう一度読む) */
export async function loadChapter(id: string): Promise<void> {
  const file = HANDS_ON_FILES.get(id);
  if (!file || loaded.has(id)) return;
  loaded.set(id, await FILES[file]());
}
