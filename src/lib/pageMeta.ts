// ページの題名。書き出す HTML (scripts/prerender.mjs) と、サイトの中で移ったときの document.title の両方がこれを使う
import { WEEKS } from '../content/curriculum';
import { findLesson } from '../content';
import glossary from '../content/glossary.json';
import { findTopic } from '../content/handbook';
import type { GlossaryTerm } from './glossary';
import type { Route } from './route';

export const SITE_TITLE = 'クラネイ — KCNA-JP 対策';

/** 画面の短い題名 (トップは undefined) */
export function pageTitle(route: Route): string | undefined {
  switch (route.name) {
    case 'home': {
      if (route.week === 1) return undefined;
      const w = WEEKS.find((x) => x.week === route.week);
      return w ? `第 ${w.week} 週 ${w.title}` : undefined;
    }
    case 'lesson': {
      const f = findLesson(route.lessonId);
      return f ? `${f.lesson.title} (第 ${f.week} 週)` : undefined;
    }
    case 'handbook':
      return route.topicId ? (findTopic(route.topicId)?.topic.title ?? 'ハンドブック') : 'ハンドブック';
    case 'glossary': {
      const t = route.termId ? (glossary as { terms: GlossaryTerm[] }).terms.find((x) => x.id === route.termId) : undefined;
      return t ? `${t.term} (用語集)` : '用語集';
    }
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

/** タブ・履歴・検索の結果に出る題名 */
export const fullTitle = (route: Route) => {
  const t = pageTitle(route);
  return t ? `${t} | ${SITE_TITLE}` : SITE_TITLE;
};
