import { describe, expect, it } from 'vitest';
import { examShareText, lessonShareText, shareNative, shareUrl, xPostUrl } from '../src/lib/share';
import { examHref, lessonHref } from '../src/lib/route';

describe('結果の共有', () => {
  it('文は点数だけ、URL は公開のサイトのページ', () => {
    expect(lessonShareText(4, 5)).toBe('4 / 5 問正解');
    expect(examShareText(45, 60)).toBe('45 / 60 問 (75%)');
    expect(shareUrl(lessonHref('w1-l1'))).toBe('https://maco165.github.io/kcna-dojo/lesson/w1-l1/');
    expect(shareUrl(examHref)).toBe('https://maco165.github.io/kcna-dojo/exam/');
  });

  it('X の投稿の URL に文と URL だけを入れる', () => {
    const u = new URL(xPostUrl({ text: '4 / 5 問正解', url: 'https://maco165.github.io/kcna-dojo/lesson/w1-l1/' }));
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
    expect([...u.searchParams.keys()]).toEqual(['text', 'url']);
    expect(u.searchParams.get('text')).toBe('4 / 5 問正解');
  });

  it('Web Share API があれば使い、閉じたら何もしない。無い・使えないなら代わりを出す (false)', async () => {
    const d = { text: 't', url: 'u' };
    const got: unknown[] = [];
    expect(await shareNative(d, { share: async (x?: ShareData) => void got.push(x) })).toBe(true);
    expect(got).toEqual([{ text: 't', url: 'u' }]);
    expect(await shareNative(d, { share: async () => Promise.reject(new DOMException('x', 'AbortError')) })).toBe(true);
    expect(await shareNative(d, { share: async () => Promise.reject(new DOMException('x', 'NotAllowedError')) })).toBe(false);
    expect(await shareNative(d, {} as Pick<Navigator, 'share'>)).toBe(false);
  });
});
