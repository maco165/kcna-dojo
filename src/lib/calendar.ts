// 進捗の画面のカレンダー (過去 26 週の学んだ日) と、この先 14 日の復習の件数。進捗の画面を開いたときにだけ読む
import { addDays, dayKey, type Progress } from './progress';

/** マスの段の下限 (その日に答えた問題の数)。1〜5 問・6〜15 問・16〜40 問・41 問から */
export const LEVEL_FLOORS = [1, 6, 16, 41] as const;
export const CALENDAR_WEEKS = 26;
export const FORECAST_DAYS = 14;

export type CalendarCell = {
  day: string;
  /** 答えた問題の数 (記録の無い前の版の日は 0) */
  count: number;
  /** 0 は学んでいない日。1〜4 は段。問題の数の記録が無くても学んだ日は 1 */
  level: 0 | 1 | 2 | 3 | 4;
  /** 今日より後 (週の残り。マスを描かない) */
  future: boolean;
};

export function levelOf(count: number, studied: boolean): CalendarCell['level'] {
  let level = 0;
  for (const [i, floor] of LEVEL_FLOORS.entries()) if (count >= floor) level = i + 1;
  return (level === 0 && studied ? 1 : level) as CalendarCell['level'];
}

/** 月曜を週の始めにした、今日を含む週の月曜 */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return addDays(day, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

/** 過去 weeks 週 (今週を含む。月曜始まり) の日ごとのマス。週ごとに 7 つ (月〜日) */
export function calendarWeeks(p: Progress, now: Date, weeks: number = CALENDAR_WEEKS): CalendarCell[][] {
  const today = dayKey(now);
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = addDays(first, w * 7 + i);
      const count = p.solved?.[day] ?? 0;
      return { day, count, level: levelOf(count, p.xp.byDay[day] !== undefined), future: day > today };
    }),
  );
}

/** マスの読み上げ: "11月20日(木) 12 問"。学んだが数の記録が無い日は "学んだ (問題の数の記録なし)" */
export function cellLabel(c: CalendarCell): string {
  const [y, m, d] = c.day.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  const what = c.count > 0 ? `${c.count} 問` : c.level > 0 ? '学んだ (問題の数の記録なし)' : '学んでいない';
  return `${m}月${d}日(${w}) ${what}`;
}

/** 明日から days 日の、日ごとの復習の件数 (1・3・7 日後の予定 nextReview から数える)。isKnown で問題データにある id に絞る */
export function reviewForecast(p: Progress, now: Date, isKnown: (id: string) => boolean = () => true, days: number = FORECAST_DAYS): { day: string; count: number }[] {
  const today = dayKey(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i + 1), count: 0 }));
  const index = new Map(out.map((o, i) => [o.day, i]));
  for (const [id, a] of Object.entries(p.answers)) {
    const i = a.nextReview === undefined ? undefined : index.get(a.nextReview);
    if (i !== undefined && isKnown(id)) out[i].count++;
  }
  return out;
}
