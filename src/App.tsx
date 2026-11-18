import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import { Theme } from '@astryxdesign/core/theme';
import jaJP from '@astryxdesign/core/locales/ja-JP.generated.js';
import { kcnaTheme } from './themes/kcna/kcna.js';
import { findLesson } from './content';
import { useRoute } from './lib/route';
import { isLazy, loadScreen, loadedScreen } from './lib/screens';
import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { colorMode } from './lib/progress';
import { useProgress } from './lib/useProgress';
import Home from './screens/Home';
import LessonScreen from './screens/LessonScreen';

export default function App() {
  const route = useRoute();
  const [progress, updateProgress] = useProgress();
  const found = route.name === 'lesson' ? findLesson(route.lessonId) : undefined;

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const lazyName = isLazy(route.name) ? route.name : undefined;
  const Screen = lazyName ? loadedScreen(lazyName) : undefined;
  // まだ読んでいない画面なら読み、読み終えたら描き直す (その間は前の画面を出したままにして、白い画面を見せない)
  useEffect(() => {
    if (lazyName && !Screen) void loadScreen(lazyName).then(rerender);
  }, [lazyName, Screen]);
  const last = useRef<ReactNode>(null);

  let screen: ReactNode;
  if (lazyName && !Screen) screen = last.current;
  else if (Screen && route.name === 'handbook') screen = <Screen key={route.topicId ?? 'index'} progress={progress} updateProgress={updateProgress} topicId={route.topicId} />;
  else if (Screen && route.name === 'glossary') screen = <Screen key={route.termId ?? 'index'} progress={progress} termId={route.termId} />;
  else if (Screen && (route.name === 'guide' || route.name === 'progress' || route.name === 'about')) screen = <Screen progress={progress} />;
  else if (Screen) screen = <Screen progress={progress} updateProgress={updateProgress} />;
  else if (found) screen = <LessonScreen key={found.lesson.id} lesson={found.lesson} week={found.week} progress={progress} updateProgress={updateProgress} />;
  else screen = <Home week={route.name === 'home' ? route.week : 1} progress={progress} />;
  if (!(lazyName && !Screen)) last.current = screen;

  return (
    <InternationalizationProvider locale="ja-JP" messages={{ 'ja-JP': jaJP }}>
      <Theme theme={kcnaTheme} mode={colorMode(progress)}>
        {screen}
      </Theme>
    </InternationalizationProvider>
  );
}
