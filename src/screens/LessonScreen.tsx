import { useCallback, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Code } from '@astryxdesign/core/Code';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ChoiceQuestionView from '../components/ChoiceQuestionView';
import FillQuestionView from '../components/FillQuestionView';
import { ActionArea, PrimaryAction, QuestionHead } from '../components/QuestionFrame';
import { DAILY_GOAL_XP } from '../content/curriculum';
import type { LabLesson, Lesson, QuizLesson } from '../content/types';
import { XP_PER_CORRECT, XP_PER_LAB } from '../lib/grade';
import { completeLesson, currentStreak, recordAnswer, todayXp, type Progress } from '../lib/progress';
import { weekHref } from '../lib/route';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Props = {
  lesson: Lesson;
  week: number;
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
};

/** 上の帯: 閉じる・レッスン名と何問目か・進み具合 */
function LessonBar({ title, week, current, total, unit }: { title: string; week: number; current: number; total: number; unit: string }) {
  return (
    <header className="lesson-bar">
      <Button variant="ghost" label="レッスンを閉じる" isIconOnly icon={<XMarkIcon width={20} height={20} />} href={weekHref(week)} />
      <div className="lesson-bar__progress">
        <Text type="supporting">
          {title} · {current} / {total} {unit}
        </Text>
        <ProgressBar label="レッスンの進み具合" isLabelHidden value={current} max={total} />
      </div>
    </header>
  );
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export default function LessonScreen(props: Props) {
  return props.lesson.kind === 'lab' ? <LabRun {...props} lesson={props.lesson} /> : <QuizRun {...props} lesson={props.lesson} />;
}

function QuizRun({ lesson, week, progress, updateProgress }: Props & { lesson: QuizLesson }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const total = lesson.questions.length;
  const q = lesson.questions[index];
  const isLast = index === total - 1;

  const onChecked = (correct: boolean) => {
    setResults((r) => [...r, correct]);
    updateProgress((p) => recordAnswer(p, q.id, correct, new Date()));
  };

  const onNext = useCallback(() => {
    if (!isLast) {
      setIndex((i) => i + 1);
      window.scrollTo(0, 0);
      return;
    }
    const correct = results.filter(Boolean).length;
    updateProgress((p) => completeLesson(p, lesson.id, { correct, total }, correct * XP_PER_CORRECT, new Date()));
    setElapsed(Date.now() - startedAt);
    setFinished(true);
    window.scrollTo(0, 0);
  }, [isLast, results, updateProgress, lesson.id, total, startedAt]);

  const restart = () => {
    setIndex(0);
    setResults([]);
    setFinished(false);
    setAttempt((a) => a + 1);
    setStartedAt(Date.now());
    window.scrollTo(0, 0);
  };

  if (finished) {
    const correct = results.filter(Boolean).length;
    return (
      <ResultView
        week={week}
        lessonLabel={`第 ${week} 週 · ${lesson.id.replace(/^w\d+-/, '')} ${lesson.title}`}
        stats={[
          { label: '正答', value: `${correct} / ${total}` },
          { label: '獲得', value: `+${correct * XP_PER_CORRECT} XP` },
          { label: '時間', value: formatDuration(elapsed) },
        ]}
        progress={progress}
        rows={lesson.questions.map((question, i) => ({ id: question.id, label: question.prompt, correct: results[i] }))}
        onRetry={restart}
        retryLabel={correct < total ? '間違いをやり直す' : 'もう一度解く'}
      />
    );
  }

  const nextLabel = isLast ? '結果を見る' : '次へ';
  return (
    <div className="lesson">
      <LessonBar title={lesson.title} week={week} current={index + 1} total={total} unit="問" />
      <main className="lesson__main">
        {q.type === 'fill' ? (
          <FillQuestionView key={`${attempt}-${q.id}`} question={q} domain={lesson.domain} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} />
        ) : (
          <ChoiceQuestionView key={`${attempt}-${q.id}`} question={q} domain={lesson.domain} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} />
        )}
      </main>
    </div>
  );
}

function LabRun({ lesson, week, progress, updateProgress }: Props & { lesson: LabLesson }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const total = lesson.steps.length;
  const allDone = checked.length === total;

  const finish = () => {
    updateProgress((p) => completeLesson(p, lesson.id, { correct: 1, total: 1 }, XP_PER_LAB, new Date()));
    setFinished(true);
    window.scrollTo(0, 0);
  };

  if (finished) {
    return (
      <ResultView
        week={week}
        lessonLabel={`第 ${week} 週 · ${lesson.title}`}
        stats={[
          { label: '手順', value: `${total} / ${total}` },
          { label: '獲得', value: `+${XP_PER_LAB} XP` },
          { label: '連続', value: `${currentStreak(progress, new Date())} 日` },
        ]}
        progress={progress}
        rows={[]}
      />
    );
  }

  return (
    <div className="lesson">
      <LessonBar title={lesson.title} week={week} current={checked.length} total={total} unit="手順" />
      <main className="lesson__main">
        <VStack gap={5}>
          <QuestionHead kind="実習 · 家のクラスタ (k3s) で動かす" domain={lesson.domain} prompt={lesson.title} />
          <CheckboxList label="手順" description="1 つずつ動かし、できたら印を付けます" value={checked} onChange={setChecked} hasDividers>
            {lesson.steps.map((s, i) => (
              <CheckboxListItem key={i} value={String(i)} label={`${i + 1}. ${s.text}`} description={s.command ? <Code>{s.command}</Code> : undefined} />
            ))}
          </CheckboxList>
          <Text type="supporting">
            出典:{' '}
            <Link href={lesson.source} isExternalLink newTabLabel="(新しいタブで開きます)">
              {new URL(lesson.source).hostname}
            </Link>
          </Text>
          <ActionArea>
            <PrimaryAction label="完了にする" onClick={finish} isDisabled={!allDone} />
          </ActionArea>
        </VStack>
      </main>
    </div>
  );
}

function ResultView({
  week,
  lessonLabel,
  stats,
  progress,
  rows,
  onRetry,
  retryLabel,
}: {
  week: number;
  lessonLabel: string;
  stats: { label: string; value: string }[];
  progress: Progress;
  rows: { id: string; label: string; correct: boolean | undefined }[];
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const now = new Date();
  const today = todayXp(progress, now);
  const reached = today >= DAILY_GOAL_XP;
  return (
    <div className="page result">
      <header className="result__head">
        <Text type="supporting">{lessonLabel}</Text>
        <h1 className="result__title">レッスン完了</h1>
      </header>

      <dl className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stats__item">
            <dt>
              <Text type="supporting">{s.label}</Text>
            </dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="band band--spaced">
        <ProgressBar
          label={reached ? '今日の目標を達成' : '今日の目標'}
          value={Math.min(today, DAILY_GOAL_XP)}
          max={DAILY_GOAL_XP}
          hasValueLabel
          formatValueLabel={() => `${today} / ${DAILY_GOAL_XP} XP · ${currentStreak(progress, now)} 日連続`}
        />
      </section>

      {rows.length > 0 && (
        <>
          <h2 className="result__sub">問題ごとの結果</h2>
          <div className="rows">
            <List hasDividers>
              {rows.map((r) => (
                <ListItem
                  key={r.id}
                  label={r.label}
                  startContent={<StatusDot variant={r.correct ? 'success' : 'error'} label={r.correct ? '正解' : '不正解'} />}
                  endContent={<Text type="supporting">{r.correct ? '正解' : '復習へ'}</Text>}
                />
              ))}
            </List>
          </div>
        </>
      )}

      <div className="result__actions">
        <HStack gap={2} justify={isWide ? 'end' : 'start'}>
          {onRetry && <Button label={retryLabel ?? 'もう一度解く'} onClick={onRetry} width={isWide ? undefined : '100%'} size={isWide ? 'md' : 'lg'} />}
          <Button
            variant="primary"
            label="一覧へ戻る"
            href={weekHref(week)}
            width={isWide ? undefined : '100%'}
            size={isWide ? 'md' : 'lg'}
          />
        </HStack>
      </div>
    </div>
  );
}
