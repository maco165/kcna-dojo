// 結果の共有。共有する文は点数とページの URL だけで、記録 (連続日数・受験日・答えの中身など) は入れない。
// URL は開いている環境 (手元の preview など) によらず、公開しているサイトの origin で作る
import { SITE_ORIGIN } from './links';

export type ShareData = { text: string; url: string };

/** ページの道 (/kcna-dojo/lesson/w1-l1/) から公開の URL */
export const shareUrl = (pathname: string) => `${SITE_ORIGIN}${pathname}`;

/** レッスンの点数の文 */
export const lessonShareText = (correct: number, total: number) => `${correct} / ${total} 問正解`;

/** 模擬試験の点数の文 */
export const examShareText = (correct: number, total: number) => `${correct} / ${total} 問 (${total > 0 ? Math.round((correct / total) * 100) : 0}%)`;

/** X の投稿の画面の URL (Web Share API の無い端末向け) */
export const xPostUrl = (d: ShareData) => `https://x.com/intent/post?${new URLSearchParams({ text: d.text, url: d.url }).toString()}`;

/**
 * 端末の共有の画面を開く。開けた (または利用者が閉じた) なら true、Web Share API が無い・使えないなら false
 * (呼ぶ側は X の投稿とリンクのコピーを出す)
 */
export async function shareNative(d: ShareData, nav: Pick<Navigator, 'share'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<boolean> {
  if (!nav?.share) return false;
  try {
    await nav.share({ text: d.text, url: d.url });
    return true;
  } catch (e) {
    // 利用者が閉じたときは何もしない。それ以外 (許可が無いなど) は代わりの方法を出す
    return e instanceof DOMException && e.name === 'AbortError';
  }
}
