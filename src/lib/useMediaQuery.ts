import { useEffect, useState } from 'react';

/** PC の画面にする幅 (Astryx の md と同じ 768px 以上) */
export const WIDE_QUERY = '(min-width: 768px)';

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
