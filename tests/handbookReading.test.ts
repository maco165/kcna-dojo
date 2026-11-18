import { describe, expect, it } from 'vitest';
import { emptyProgress, markHandbookSeen, normalizeProgress, setHandbookDone } from '../src/lib/progress';

const now = new Date('2026-11-18T00:00:00Z');

describe('ハンドブックの読んだ記録', () => {
  it('読んだ段は前より進んだときだけ書き換える (戻ってスクロールしても減らない)', () => {
    let p = markHandbookSeen(emptyProgress(), 'core-concepts', 3, now);
    expect(p.handbook?.['core-concepts'].seen).toBe(3);
    const same = markHandbookSeen(p, 'core-concepts', 2, now);
    expect(same).toBe(p);
    p = markHandbookSeen(p, 'core-concepts', 5, now);
    expect(p.handbook?.['core-concepts'].seen).toBe(5);
  });
  it('確認済みは付け外しでき、外しても読んだ段は残る', () => {
    let p = markHandbookSeen(emptyProgress(), 'storage', 4, now);
    p = setHandbookDone(p, 'storage', true, now);
    expect(p.handbook?.storage).toMatchObject({ seen: 4, done: true });
    p = setHandbookDone(p, 'storage', false, now);
    expect(p.handbook?.storage.done).toBeUndefined();
    expect(p.handbook?.storage.seen).toBe(4);
    // 読まずに確認済みにもできる
    expect(setHandbookDone(emptyProgress(), 'debugging', true, now).handbook?.debugging).toMatchObject({ seen: 0, done: true });
  });
  it('読み込みで形を整える (知らない形・負の数・おかしな id を捨て、記録が無ければ欄を作らない)', () => {
    const p = normalizeProgress({
      v: 1,
      handbook: { 'core-concepts': { seen: 3.7, done: true, at: 'x' }, storage: { seen: -1 }, 'Bad Id': { seen: 2 }, debugging: 'x', networking: { done: 'yes' } },
    });
    expect(p?.handbook).toEqual({ 'core-concepts': { seen: 3, done: true, at: 'x' } });
    expect(normalizeProgress({ v: 1 })?.handbook).toBeUndefined();
  });
});
