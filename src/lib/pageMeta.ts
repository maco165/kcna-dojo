// ページの題名 (ハンドブックのトピックと用語集の語まで)。書き出す HTML (scripts/prerender.mjs) と、
// サイトの中でハンドブックのトピック・用語集の語へ移ったときの document.title が使う。データを持つので後から読む
import glossary from '../content/glossary.json';
import { findTopic } from '../content/handbook';
import { findCommandPage } from '../content/commandPages';
import type { GlossaryTerm } from './glossary';
import { lightTitle, SITE_TITLE, withSite } from './pageTitle';
import type { Route } from './route';

export { SITE_TITLE };

/** 画面の短い題名 (トップは undefined) */
export function pageTitle(route: Route): string | undefined {
  if (route.name === 'handbook' && route.topicId) return findTopic(route.topicId)?.topic.title ?? 'ハンドブック';
  if (route.name === 'glossary' && route.termId) {
    const t = (glossary as { terms: GlossaryTerm[] }).terms.find((x) => x.id === route.termId);
    return t ? `${t.term} (用語集)` : '用語集';
  }
  if (route.name === 'commands' && route.commandId) {
    const c = findCommandPage(route.commandId);
    return c ? `${c.command} の中身と使い方` : 'コマンド';
  }
  return lightTitle(route);
}

/** タブ・履歴・検索の結果に出る題名 */
export const fullTitle = (route: Route) => withSite(pageTitle(route));
