// 問題データと用語集から、説明のページに出す数を数える (数字を手で書かないため)
import type { WeekContent } from '../content/types';

export type ContentStats = {
  weeks: number;
  lessons: number;
  labs: number;
  questions: number;
  terms: number;
  /** 問題の出典のホストごとの数。多い順 */
  sources: { host: string; count: number }[];
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(読めない URL)';
  }
}

export function contentStats(weeks: (WeekContent | undefined)[], termCount: number): ContentStats {
  const hosts = new Map<string, number>();
  let lessons = 0;
  let labs = 0;
  let questions = 0;
  let withContent = 0;
  for (const w of weeks) {
    if (!w) continue;
    withContent++;
    for (const l of w.lessons) {
      lessons++;
      if (l.kind === 'lab') {
        labs++;
        continue;
      }
      for (const q of l.questions) {
        questions++;
        const h = hostOf(q.source);
        hosts.set(h, (hosts.get(h) ?? 0) + 1);
      }
    }
  }
  const sources = [...hosts.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
  return { weeks: withContent, lessons, labs, questions, terms: termCount, sources };
}
