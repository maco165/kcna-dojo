// 題名のうち、本体にあるデータだけで決まるもの (ハンドブックのトピックと用語集の語を除く)。
// ハンドブックと用語集の題名は pageMeta.ts が、そのデータと一緒に読んで決める
import { WEEKS } from '../content/curriculum';
import { findLesson } from '../content';
import type { Route } from './route';

export const SITE_TITLE = 'クラネイ — KCNA-JP 対策';

/** ハンドブックのトピックか用語集の語なら、題名に重いデータが要る */
export const needsHeavyTitle = (route: Route) => (route.name === 'handbook' && !!route.topicId) || (route.name === 'glossary' && !!route.termId) || (route.name === 'compare' && !!route.tableId) || (route.name === 'commands' && !!route.commandId);

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
      return f ? `${f.lesson.title} (第 ${f.week} 週)` : undefined;
    }
    case 'handbook':
      return 'ハンドブック';
    case 'glossary':
      return '用語集';
    case 'compare':
      return '似た語の比較表';
    case 'commands':
      return 'コマンド';
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

export const withSite = (t: string | undefined) => (t ? `${t} | ${SITE_TITLE}` : SITE_TITLE);
