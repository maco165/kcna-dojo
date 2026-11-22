// 題名のうち、本体にあるデータだけで決まるもの (ハンドブックのトピック・用語集の語・比較表の表・コマンドのページを除く)。
// ハンドブックと用語集の題名は pageMeta.ts が、比較表の表の題名は route.ts が比較表のデータだけを読んで決める
import { WEEKS } from '../content/curriculum';
import { findLesson } from '../content';
import type { Route } from './route';
import { SITE_NAME, SITE_TAGLINE } from './site';

/** トップの題名。ほかのページは「ページの名前 | クラネイ」にする (検索の結果で切られない長さに収めるため。全ページ 35 字以内は tests/pages.test.ts が見る) */
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/** ハンドブックのトピックか用語集の語なら、題名に重いデータが要る */
export const needsHeavyTitle = (route: Route) => (route.name === 'handbook' && !!route.topicId) || (route.name === 'glossary' && !!route.termId);

/** 画面の短い題名 (トップは undefined)。ハンドブックのトピックと用語集の語は、ここでは一覧の名前を返す */
export function lightTitle(route: Route): string | undefined {
  switch (route.name) {
    case 'home': {
      if (route.week === 1) return undefined;
      const w = WEEKS.find((x) => x.week === route.week);
      return w ? `第 ${w.week} 週 ${w.title}` : undefined;
    }
    case 'lesson': {
      const f = findLesson(route.lessonId);
      // 週はパンくずに出すので題名には入れない (35 字に収めるため。レッスンの名前は週をまたいで重ならない)
      return f ? f.lesson.title : undefined;
    }
    case 'handbook':
      return 'ハンドブック';
    case 'glossary':
      return '用語集';
    // 比較表の表とコマンドのページの題名は、それぞれのデータが要るので、ここでは決めない (route.ts と prerender が決める)
    case 'compare':
      return route.tableId ? undefined : '似た語の比較表';
    case 'commands':
      return route.commandId ? undefined : 'コマンド';
    case 'guide':
      return 'Kubernetes とこのサイト';
    case 'review':
      return '復習';
    case 'progress':
      return '進捗';
    case 'settings':
      return '設定';
    case 'exam':
      return '模擬試験';
    case 'about':
      return 'このサイトについて';
  }
}

/** 題名の長さの上限 (検索の結果で切られにくい長さ)。字数は文字の数で数える */
export const TITLE_MAX = 35;
const SUFFIX = ` | ${SITE_NAME}`;

/** タブ・履歴・検索の結果に出る題名。サイト名を足すと上限を超える名前は、名前だけにする (トップは SITE_TITLE) */
export const withSite = (t: string | undefined) => (!t ? SITE_TITLE : [...t].length + [...SUFFIX].length <= TITLE_MAX ? `${t}${SUFFIX}` : t);
