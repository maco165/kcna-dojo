import { Theme } from '@astryxdesign/core/theme';
import { kcnaTheme } from './themes/kcna/kcna.js';
import { findLesson } from './content';
import { useRoute } from './lib/route';
import { useProgress } from './lib/useProgress';
import Home from './screens/Home';
import LessonScreen from './screens/LessonScreen';

export default function App() {
  const route = useRoute();
  const [progress, updateProgress] = useProgress();
  const found = route.name === 'lesson' ? findLesson(route.lessonId) : undefined;

  return (
    <Theme theme={kcnaTheme} mode="system">
      {found ? (
        <LessonScreen key={found.lesson.id} lesson={found.lesson} week={found.week} progress={progress} updateProgress={updateProgress} />
      ) : (
        <Home week={route.name === 'home' ? route.week : 1} progress={progress} />
      )}
    </Theme>
  );
}
