/**
 * 打った時刻を HH:MM にする (全角の数字・コロン、「8:5」「2030」のような書き方も読む)。読めなければ null。
 * 設定の .ics の時刻の欄に使う (時刻の部品 TimeInput は設定の画面を重くするので、文字の欄で受ける)
 */
export function normalizeTime(input: string): string | null {
  const s = input.replace(/[０-９：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  const m = s.match(/^(\d{1,2}):(\d{1,2})$/) ?? s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
