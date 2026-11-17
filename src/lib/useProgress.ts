import { useCallback, useState } from 'react';
import { loadProgress, saveProgress, type Progress } from './progress';

/** 進捗を読み、変えるたびに localStorage へ書く */
export function useProgress(): [Progress, (update: (p: Progress) => Progress) => void] {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);
  return [progress, update];
}
