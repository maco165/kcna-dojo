import { useEffect, useState } from 'react';

// GitHub Pages ではサーバーで経路を振り分けられないので、URL の # の後ろで画面を決める。
export type Route = { name: 'home'; week: number } | { name: 'lesson'; lessonId: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const lesson = path.match(/^\/lesson\/([\w-]+)$/);
  if (lesson) return { name: 'lesson', lessonId: lesson[1] };
  const week = path.match(/^\/week\/(\d+)$/);
  if (week) return { name: 'home', week: Number(week[1]) };
  return { name: 'home', week: 1 };
}

export const lessonHref = (lessonId: string) => `#/lesson/${lessonId}`;
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
