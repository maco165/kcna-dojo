// 実践の章の「ここで詰まった」: GitHub の新しい Issue を、詰まり用の書式 (.github/ISSUE_TEMPLATE/stuck.yml) で開き、
// 章・手順・画面で選んだ OS・章の版の欄を URL の query で埋める (欄の id が query の名前。GitHub の issue forms の事前入力)。
// 入れるのは章と手順とページのことだけ。印・記録・端末の情報など、利用者のことは入れない (links.ts の reportIssueUrl と同じ考え)
import { NEW_ISSUE_URL, SITE_ORIGIN } from './links';

export const STUCK_TEMPLATE = 'stuck.yml';
/** 書式の欄の id (stuck.yml と同じ。tests/stuck.test.ts が突き合わせる) */
export const STUCK_FIELDS = ['chapter', 'step', 'page', 'chapter-os', 'chapter-k3s'] as const;
/** 手順の本文は頭だけ入れる (URL を長くしない) */
export const STEP_HEAD = 80;

/** 章を書いたときの k3s の版 (入れるコマンドの INSTALL_K3S_VERSION)。vite.config.ts の ?meta と書き出しが使う */
export function k3sVersionOf(text: string): string | undefined {
  return text.match(/INSTALL_K3S_VERSION=(v\d+\.\d+\.\d+\+k3s\d+)/)?.[1];
}

/** 章の版: その章か、それより前でいちばん近い章が入れた版。まだ k3s を入れていない章は undefined */
export function chapterK3s(id: string, chapters: { id: string; order: number; k3s?: string }[]): string | undefined {
  const at = chapters.find((c) => c.id === id);
  if (!at) return undefined;
  return [...chapters].filter((c) => c.order <= at.order && c.k3s).sort((a, b) => b.order - a.order)[0]?.k3s;
}

const head = (t: string) => (t.length > STEP_HEAD ? `${t.slice(0, STEP_HEAD - 1)}…` : t);

/**
 * 詰まりを書く Issue の URL。os は画面で選んだ OS の名前 (書き出しの HTML では分からないので無し)。
 * where は画面の番号 (「手順 3」「後片付け 1」。OS で手順の数が変わるので、手順の id も入れる)
 */
export function stuckIssueUrl(a: { chapter: { id: string; order: number; title: string }; step: { id: string; text: string }; where: string; os?: string; k3s?: string; pathname: string }): string {
  const q = new URLSearchParams({
    template: STUCK_TEMPLATE,
    title: `詰まった: ${a.chapter.order} 章 ${a.where} (${a.chapter.id} / ${a.step.id})`,
    chapter: `${a.chapter.order} 章「${a.chapter.title}」(${a.chapter.id})`,
    step: `${a.where} (${a.step.id}): ${head(a.step.text)}`,
    page: `${SITE_ORIGIN}${a.pathname}#step-${a.step.id}`,
    'chapter-os': a.os ?? '選んでいない (JavaScript の無いページから)',
    'chapter-k3s': a.k3s ?? 'この章では k3s を使わない',
  });
  return `${NEW_ISSUE_URL}?${q.toString()}`;
}
