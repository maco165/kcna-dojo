import { useEffect, useState } from 'react';

// GitHub Pages ではサーバーで経路を振り分けられないので、URL の # の後ろで画面を決める。
export type Route = { name: 'home'; week: number } | { name: 'lesson'; lessonId: string } | { name: 'about' } | { name: 'settings' } | { name: 'review' } | { name: 'progress' } | { name: 'glossary' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const lesson = path.match(/^\/lesson\/([\w-]+)$/);
  if (lesson) return { name: 'lesson', lessonId: lesson[1] };
  if (path === '/about') return { name: 'about' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/review') return { name: 'review' };
  if (path === '/progress') return { name: 'progress' };
  if (path === '/glossary') return { name: 'glossary' };
  const week = path.match(/^\/week\/(\d+)$/);
  if (week) return { name: 'home', week: Number(week[1]) };
  return { name: 'home', week: 1 };
}

export const lessonHref = (lessonId: string) => `#/lesson/${lessonId}`;
export const aboutHref = '#/about';
export const settingsHref = '#/settings';
export const reviewHref = '#/review';
export const progressHref = '#/progress';
export const glossaryHref = '#/glossary';
export const weekHref = (week: number) => `#/week/${week}`;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
