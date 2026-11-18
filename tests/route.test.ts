import { describe, expect, it } from 'vitest';
import { BASE, glossaryTermHref, handbookHref, legacyHashToPath, lessonHref, parseRoute, weekHref } from '../src/lib/route';

describe('# の無い URL の経路', () => {
  it('置き場所は /kcna-dojo/ で、リンクは末尾に / を付ける (書き出したページの場所と同じ)', () => {
    expect(BASE).toBe('/kcna-dojo/');
    expect(handbookHref('core-concepts')).toBe('/kcna-dojo/handbook/core-concepts/');
    expect(handbookHref()).toBe('/kcna-dojo/handbook/');
    expect(lessonHref('w1-l1')).toBe('/kcna-dojo/lesson/w1-l1/');
    expect(weekHref(3)).toBe('/kcna-dojo/week/3/');
    expect(glossaryTermHref('etcd')).toBe('/kcna-dojo/glossary/etcd/');
  });
  it('リンクの URL から、同じ画面に戻る (作った URL を読むと元の画面)', () => {
    expect(parseRoute(handbookHref('core-concepts'))).toEqual({ name: 'handbook', topicId: 'core-concepts' });
    expect(parseRoute(lessonHref('w1-l1'))).toEqual({ name: 'lesson', lessonId: 'w1-l1' });
    expect(parseRoute(weekHref(3))).toEqual({ name: 'home', week: 3 });
    expect(parseRoute('/kcna-dojo/')).toEqual({ name: 'home', week: 1 });
    expect(parseRoute('/kcna-dojo/handbook')).toEqual({ name: 'handbook' });
    expect(parseRoute('/kcna-dojo/no-such-page/')).toEqual({ name: 'home', week: 1 });
  });
  it('前の形の #/... は、同じページの新しい URL にする', () => {
    expect(legacyHashToPath('#/handbook/storage')).toBe('/kcna-dojo/handbook/storage/');
    expect(legacyHashToPath('#/')).toBe('/kcna-dojo/');
    expect(legacyHashToPath('#goals')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
    expect(parseRoute(legacyHashToPath('#/week/2')!)).toEqual({ name: 'home', week: 2 });
  });
});
