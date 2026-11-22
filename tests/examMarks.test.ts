import { describe, expect, it } from 'vitest';
import { confirmText, questionNavLabel } from '../src/lib/exam';

describe('模擬試験の見直しの印', () => {
  it('一覧のボタンは状態を文字で読み上げる (色だけに頼らない)', () => {
    expect(questionNavLabel(2, true, true, false)).toBe('3 問目 回答済み・見直す印あり');
    expect(questionNavLabel(0, false, false, true)).toBe('1 問目 未回答・表示中');
  });

  it('採点の前の確かめに、未回答と印の数を出す', () => {
    expect(confirmText(60, 57, 2)).toBe('まだ答えていない問題が 3 問あります (不正解になります)。「あとで見直す」の印が 2 問に付いています。「続ける」で問題の一覧に戻れます。');
    expect(confirmText(60, 60, 0)).toBe('すべての問題に答えました。見直す印の付いた問題はありません。');
    expect(confirmText(60, 60, 1)).toContain('印が 1 問');
  });
});
