import { useEffect, useState } from 'react';
import { lightTitle, needsHeavyTitle, withSite } from './pageTitle';
import { onRouteChanged, savePosition, startScrollMemory } from './scrollMemory';

// 経路は # の無い URL (/kcna-dojo/handbook/core-concepts/ など) で、History API で切り替える。
// 検索エンジンは # の後ろを別のページとして扱わないため。ページごとの index.html は作るときに scripts/prerender.mjs が書き出す。
// 前の形の #/... の URL は、開いたときに同じページの新しい URL へ置き換える。
export type Route = { name: 'home'; week: number } | { name: 'lesson'; lessonId: string } | { name: 'about' } | { name: 'settings' } | { name: 'review' } | { name: 'progress' } | { name: 'exam' } | { name: 'glossary'; termId?: string } | { name: 'guide' } | { name: 'handbook'; topicId?: string } | { name: 'compare'; tableId?: string };

/** サイトの置き場所 (vite の base。/kcna-dojo/) */
export const BASE = import.meta.env.BASE_URL;

/** URL の道 (pathname) か、前の形の #/... から画面を決める */
export function parseRoute(where: string): Route {
  const path = (where.startsWith('#') ? where.slice(1) : where.startsWith(BASE) ? `/${where.slice(BASE.length)}` : where).replace(/\/+$/, '') || '/';
  const lesson = path.match(/^\/lesson\/([\w-]+)$/);
  if (lesson) return { name: 'lesson', lessonId: lesson[1] };
  if (path === '/about') return { name: 'about' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/review') return { name: 'review' };
  if (path === '/progress') return { name: 'progress' };
  if (path === '/exam') return { name: 'exam' };
  if (path === '/glossary') return { name: 'glossary' };
  const term = path.match(/^\/glossary\/([\w-]+)$/);
  if (term) return { name: 'glossary', termId: term[1] };
  if (path === '/guide') return { name: 'guide' };
  if (path === '/compare') return { name: 'compare' };
  const compare = path.match(/^\/compare\/([^/]+)$/);
  if (compare) return { name: 'compare', tableId: compare[1].toLowerCase() };
  if (path === '/handbook') return { name: 'handbook' };
  const handbook = path.match(/^\/handbook\/([^/]+)$/);
  // 知らない id でもハンドブックの画面に回し、「見つかりませんでした」と目次へのリンクを出す
  if (handbook) return { name: 'handbook', topicId: handbook[1].toLowerCase() };
  const week = path.match(/^\/week\/(\d+)$/);
  if (week) return { name: 'home', week: Number(week[1]) };
  return { name: 'home', week: 1 };
}

/** 前の形の #/... を、同じページの新しい URL にする (#/ で始まらなければ null) */
export function legacyHashToPath(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const p = hash.slice(2).replace(/\/+$/, '');
  return p ? `${BASE}${p}/` : BASE;
}

const href = (p: string) => `${BASE}${p}/`;
export const lessonHref = (lessonId: string) => href(`lesson/${lessonId}`);
export const aboutHref = href('about');
export const settingsHref = href('settings');
export const reviewHref = href('review');
export const progressHref = href('progress');
export const examHref = href('exam');
export const glossaryHref = href('glossary');
export const glossaryTermHref = (termId: string) => href(`glossary/${termId}`);
export const guideHref = href('guide');
export const handbookHref = (topicId?: string) => href(topicId ? `handbook/${topicId}` : 'handbook');
export const compareHref = (tableId?: string) => href(tableId ? `compare/${tableId}` : 'compare');
/** 第 1 週はトップと同じ画面なので、トップの URL を正にする (同じ画面の URL を 2 つにしない) */
export const weekHref = (week: number) => (week === 1 ? BASE : href(`week/${week}`));

/** サイトの中へのリンクなら、ページを読み直さずに切り替える (新しいタブ・修飾キー・外のサイト・同じページの中の印は除く) */
function internalTarget(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || !a.href || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const u = new URL(a.href, window.location.href);
  if (u.origin !== window.location.origin || !u.pathname.startsWith(BASE)) return null;
  if (u.pathname === window.location.pathname && u.hash) return null;
  return u.pathname + u.search + u.hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => {
    const legacy = legacyHashToPath(window.location.hash);
    if (legacy) history.replaceState(history.state, '', legacy);
    return parseRoute(window.location.pathname);
  });
  useEffect(() => {
    startScrollMemory();
    let shown = window.location.pathname;
    const show = () => {
      shown = window.location.pathname;
      const next = parseRoute(shown);
      setRoute(next);
      // 書き出した HTML の題名はページごとなので、サイトの中で移ったときも合わせる。
      // ハンドブックのトピックと用語集の語だけは、題名に重いデータが要るので後から読む (読み終えたときに、まだ同じページにいるときだけ書く)
      const at = shown;
      if (needsHeavyTitle(next)) void import('./pageMeta').then((m) => shown === at && (document.title = m.fullTitle(next)));
      else document.title = withSite(lightTitle(next));
      onRouteChanged();
    };
    const onPop = () => {
      // 前の形の #/... のリンクを押したとき (ページの中に残っていても) も新しい URL にする
      const legacy = legacyHashToPath(window.location.hash);
      if (legacy) history.replaceState(null, '', legacy);
      // 同じページの中の印 (#...) への移動は、画面を切り替えない
      if (window.location.pathname === shown) return;
      // 前のページの画面がまだあるうちに、その位置を覚える (覚える先は前のページの鍵)
      savePosition();
      show();
    };
    const onClick = (e: MouseEvent) => {
      const to = internalTarget(e);
      if (!to) return;
      e.preventDefault();
      if (to === window.location.pathname + window.location.search + window.location.hash) return;
      // 前のページの画面がまだあるうちに、その位置を覚える
      savePosition();
      history.pushState(null, '', to);
      show();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return route;
}
