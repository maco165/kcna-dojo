import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import { Theme } from '@astryxdesign/core/theme';
import jaJP from '@astryxdesign/core/locales/ja-JP.generated.js';
import { kcnaTheme } from './themes/kcna/kcna.js';
import { findLesson } from './content';
import { useRoute } from './lib/route';
import { colorMode } from './lib/progress';
import { useProgress } from './lib/useProgress';
import About from './screens/About';
import Home from './screens/Home';
import ExamScreen from './screens/ExamScreen';
import Glossary from './screens/Glossary';
import ProgressScreen from './screens/ProgressScreen';
import Review from './screens/Review';
import Settings from './screens/Settings';
import LessonScreen from './screens/LessonScreen';

export default function App() {
  const route = useRoute();
  const [progress, updateProgress] = useProgress();
  const found = route.name === 'lesson' ? findLesson(route.lessonId) : undefined;

  return (
    <InternationalizationProvider locale="ja-JP" messages={{ 'ja-JP': jaJP }}>
    <Theme theme={kcnaTheme} mode={colorMode(progress)}>
      {route.name === 'exam' ? (
        <ExamScreen progress={progress} updateProgress={updateProgress} />
      ) : route.name === 'glossary' ? (
        <Glossary progress={progress} />
      ) : route.name === 'progress' ? (
        <ProgressScreen progress={progress} />
      ) : route.name === 'review' ? (
        <Review progress={progress} updateProgress={updateProgress} />
      ) : route.name === 'settings' ? (
        <Settings progress={progress} updateProgress={updateProgress} />
      ) : route.name === 'about' ? (
        <About progress={progress} />
      ) : found ? (
        <LessonScreen key={found.lesson.id} lesson={found.lesson} week={found.week} progress={progress} updateProgress={updateProgress} />
      ) : (
        <Home week={route.name === 'home' ? route.week : 1} progress={progress} />
      )}
    </Theme>
    </InternationalizationProvider>
  );
}
