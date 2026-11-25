// 実践の全部の章の全文。書き出し (scripts/prerender.mjs) とテストだけが読む。画面は handsOnChapters.ts から、開いた章だけを読む
import type { HandsOnChapter } from './types';

const FILES = import.meta.glob<HandsOnChapter>('./hands-on/*.json', { eager: true, import: 'default' });

export const HANDS_ON_CHAPTERS: HandsOnChapter[] = Object.values(FILES).sort((a, b) => a.order - b.order);
