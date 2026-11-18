import { describe, expect, it } from 'vitest';
import { answerHistory, emptyProgress, recordAnswer } from '../src/lib/progress';

describe('問題ごとの解いた記録の 1 行', () => {
  it('記録が無ければ「はじめて」', () => {
    expect(answerHistory(undefined)).toBe('はじめて');
    expect(answerHistory({ right: 0, wrong: 0, last: '' })).toBe('はじめて');
  });
  it('解いた回数・正解と不正解の数・最後に解いた日を出す', () => {
    let p = recordAnswer(emptyProgress(), 'w1-l1-q1', false, new Date(2026, 10, 16, 9));
    // 端末の時刻の朝 8 時 (日本では UTC だと前の日) で、UTC ではなく端末の日付で出すことを確かめる
    p = recordAnswer(p, 'w1-l1-q1', true, new Date(2026, 10, 18, 8));
    expect(answerHistory(p.answers['w1-l1-q1'])).toBe('これまで 2 回 (正解 1・不正解 1) · 最後 11/18');
  });
  it('日付が読めない記録でも回数は出す', () => {
    expect(answerHistory({ right: 1, wrong: 0, last: 'x' })).toBe('これまで 1 回 (正解 1・不正解 0)');
  });
});
