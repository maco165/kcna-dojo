import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import { Theme } from '@astryxdesign/core/theme';
import jaJP from '@astryxdesign/core/locales/ja-JP.generated.js';
import { kcnaTheme } from './themes/kcna/kcna.js';
import { findLesson } from './content';
import { useRoute } from './lib/route';
import { isLazy, loadScreen, loadedScreen, reloadOnce } from './lib/screens';
import { retryRestore } from './lib/scrollMemory';
import { useEffect, useLayoutEffect, useReducer, useRef, type ReactNode } from 'react';
import { colorMode } from './lib/progress';
import { useProgress } from './lib/useProgress';
import Home from './screens/Home';
import { LoadBoundary, LoadFailed } from './components/LoadBoundary';

export default function App() {
  const route = useRoute();
  const [progress, updateProgress] = useProgress();
  const found = route.name === 'lesson' ? findLesson(route.lessonId) : undefined;

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // 知らないレッスンの id はホームを出す (レッスンの部品を読まない)
  const lazyName = isLazy(route.name) && !(route.name === 'lesson' && !found) ? route.name : undefined;
  const Screen = lazyName ? loadedScreen(lazyName) : undefined;
  // まだ読んでいない画面なら読み、読み終えたら描き直す (その間は前の画面を出したままにして、白い画面を見せない)
  useEffect(() => {
    if (!lazyName || Screen) return;
    document.documentElement.dataset.loading = 'true';
    void loadScreen(lazyName).then(rerender, () => {
      // 読めなければページごと読み直す (書き出した HTML が返る)。2 回目も読めなければ、そのまま前の画面を出しておく
      reloadOnce();
    });
  }, [lazyName, Screen]);
  // 開いたときに読む画面を描き終えたら、読み込み中の印を外し、戻せなかった位置をもう一度戻す
  useLayoutEffect(() => {
    if (lazyName && !Screen) return;
    delete document.documentElement.dataset.loading;
    retryRestore();
  }, [lazyName, Screen]);
  const last = useRef<ReactNode>(null);

  let screen: ReactNode;
  if (lazyName && !Screen) screen = last.current;
  else if (Screen && route.name === 'handbook') screen = <Screen key={route.topicId ?? 'index'} progress={progress} updateProgress={updateProgress} topicId={route.topicId} />;
  else if (Screen && route.name === 'commands') screen = <Screen key={route.commandId ?? 'index'} progress={progress} commandId={route.commandId} />;
  else if (Screen && route.name === 'compare') screen = <Screen key={route.tableId ?? 'index'} progress={progress} tableId={route.tableId} />;
  else if (Screen && route.name === 'glossary') screen = <Screen key={route.termId ?? 'index'} progress={progress} termId={route.termId} />;
  else if (Screen && (route.name === 'guide' || route.name === 'progress' || route.name === 'about')) screen = <Screen progress={progress} />;
  else if (Screen && route.name === 'lesson') screen = <Screen key={route.lessonId} lessonId={route.lessonId} progress={progress} updateProgress={updateProgress} />;
  else if (Screen) screen = <Screen progress={progress} updateProgress={updateProgress} />;
  else screen = <Home week={route.name === 'home' ? route.week : 1} progress={progress} />;
  if (!(lazyName && !Screen)) last.current = screen;

  return (
    <InternationalizationProvider locale="ja-JP" messages={{ 'ja-JP': jaJP }}>
      <Theme theme={kcnaTheme} mode={colorMode(progress)}>
        {/* 画面の部品が描画の途中で投げても (後から読むチャンクが 404 など)、白紙にせず読み直しを出す */}
        <LoadBoundary resetKey={JSON.stringify(route)} fallback={<LoadFailed />}>
          {screen}
        </LoadBoundary>
      </Theme>
    </InternationalizationProvider>
  );
}
