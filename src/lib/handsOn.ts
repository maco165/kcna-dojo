// 実践の章: OS の出し分けと、完了の数え方
import type { HandsOnMeta, HandsOnOs } from '../content/types';
import type { HandsOnRecord, Progress } from './progress';

export const OS_CHOICES: readonly HandsOnOs[] = ['windows', 'mac', 'linux'];
export const OS_LABEL: Record<HandsOnOs, string> = { windows: 'Windows', mac: 'Mac', linux: 'Linux' };
export const WHERE_LABEL = { host: '自分の PC で', vm: '仮想マシンの中で' } as const;

/** 端末から OS を推す (選ぶまでの既定)。スマホで読む人は、数の多い Windows にする */
export function guessOs(ua: string): HandsOnOs {
  if (/Android|iPhone|iPad/.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'mac';
  if (/Linux|CrOS/.test(ua)) return 'linux';
  return 'windows';
}

/** 選んだ OS。選んでいなければ端末から推す */
export const handsOnOs = (p: Progress, ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): HandsOnOs => p.profile?.os ?? guessOs(ua);

/** その OS の人がする手順 (ほかの OS だけの手順を除く) */
export const stepsFor = <S extends { os?: HandsOnOs }>(steps: S[], os: HandsOnOs): S[] => steps.filter((s) => !s.os || s.os === os);

/** 印を付けた手順の数と、その OS の人がする手順の数。ほかの OS の手順と、無くなった手順の印は数えない */
export function markedCount(chapter: Pick<HandsOnMeta, 'steps'>, rec: HandsOnRecord | undefined, os: HandsOnOs): { marked: number; total: number } {
  const mine = stepsFor(chapter.steps, os);
  return { marked: mine.filter((s) => rec?.steps.includes(s.id)).length, total: mine.length };
}

/** 完了にできるか: その OS の人がする手順が 1 つ以上あり、全部に印がある */
export const canComplete = (n: { marked: number; total: number }) => n.total > 0 && n.marked >= n.total;

/** 一覧に出す章の状態 */
export function chapterStatus(chapter: Pick<HandsOnMeta, 'id' | 'steps'>, p: Progress, os: HandsOnOs): { done: boolean; text: string } {
  const rec = p.handsOn?.[chapter.id];
  const { marked, total } = markedCount(chapter, rec, os);
  if (rec?.done) return { done: true, text: '完了' };
  return { done: false, text: marked > 0 ? `途中 ${marked} / ${total} 手順` : '未着手' };
}

/** 完了した章の数 */
export const doneChapters = (chapters: Pick<HandsOnMeta, 'id'>[], p: Progress) => chapters.filter((c) => p.handsOn?.[c.id]?.done).length;
