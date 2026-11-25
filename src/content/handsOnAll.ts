// 実践の章の全文。章の画面を開いたときだけ読む (一覧と題名は handsOn.ts の軽い形を使う)
import type { HandsOnChapter } from './types';

const FILES = import.meta.glob<HandsOnChapter>('./hands-on/*.json', { eager: true, import: 'default' });

export const HANDS_ON_CHAPTERS: HandsOnChapter[] = Object.values(FILES).sort((a, b) => a.order - b.order);
