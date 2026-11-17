import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Code } from '@astryxdesign/core/Code';
import { Heading } from '@astryxdesign/core/Heading';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ChoiceQuestionView from '../components/ChoiceQuestionView';
import FillQuestionView from '../components/FillQuestionView';
import { DAILY_GOAL_XP } from '../content/curriculum';
import type { LabLesson, Lesson, QuizLesson } from '../content/types';
import { XP_PER_CORRECT, XP_PER_LAB } from '../lib/grade';
import { completeLesson, currentStreak, recordAnswer, todayXp, type Progress } from '../lib/progress';
import { weekHref } from '../lib/route';

type Props = {
  lesson: Lesson;
  week: number;
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
};

function LessonHeader({ title, week, current, total }: { title: string; week: number; current: number; total: number }) {
  return (
    <LayoutHeader>
      <HStack gap={3} vAlign="center">
        <Button variant="ghost" label="レッスンを閉じる" isIconOnly icon={<XMarkIcon width={20} height={20} />} href={weekHref(week)} />
        <VStack gap={1} width="100%">
          <Text type="supporting">
            {title} · {current} / {total}
          </Text>
          <ProgressBar label="レッスンの進み具合" isLabelHidden value={current} max={total} />
        </VStack>
      </HStack>
    </LayoutHeader>
  );
}

export default function LessonScreen(props: Props) {
  return props.lesson.kind === 'lab' ? <LabRun {...props} lesson={props.lesson} /> : <QuizRun {...props} lesson={props.lesson} />;
}

function QuizRun({ lesson, week, progress, updateProgress }: Props & { lesson: QuizLesson }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const total = lesson.questions.length;
  const q = lesson.questions[index];
  const isLast = index === total - 1;

  const onChecked = (correct: boolean) => {
    setResults((r) => [...r, correct]);
    updateProgress((p) => recordAnswer(p, q.id, correct, new Date()));
  };

  const onNext = () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      window.scrollTo(0, 0);
      return;
    }
    const correct = results.filter(Boolean).length;
    updateProgress((p) => completeLesson(p, lesson.id, { correct, total }, correct * XP_PER_CORRECT, new Date()));
    setFinished(true);
  };

  const restart = () => {
    setIndex(0);
    setResults([]);
    setFinished(false);
    setAttempt((a) => a + 1);
  };

  if (finished) {
    const correct = results.filter(Boolean).length;
    return (
      <Layout
        height="auto"
        contentWidth={760}
        header={<LessonHeader title={lesson.title} week={week} current={total} total={total} />}
        content={
          <LayoutContent padding={4}>
            <ResultView
              title={lesson.title}
              stats={[
                { label: '正答', value: `${correct} / ${total}` },
                { label: '獲得', value: `+${correct * XP_PER_CORRECT} XP` },
                { label: '連続', value: `${currentStreak(progress, new Date())} 日` },
              ]}
              progress={progress}
              rows={lesson.questions.map((question, i) => ({ id: question.id, label: question.prompt, correct: results[i] }))}
              week={week}
              onRetry={restart}
            />
          </LayoutContent>
        }
      />
    );
  }

  const nextLabel = isLast ? '結果を見る' : '次へ';
  return (
    <Layout
      height="auto"
      contentWidth={760}
      header={<LessonHeader title={lesson.title} week={week} current={index + 1} total={total} />}
      content={
        <LayoutContent padding={4}>
          {q.type === 'fill' ? (
            <FillQuestionView key={`${attempt}-${q.id}`} question={q} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} />
          ) : (
            <ChoiceQuestionView key={`${attempt}-${q.id}`} question={q} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} />
          )}
        </LayoutContent>
      }
    />
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
  };

  return (
    <Layout
      height="auto"
      contentWidth={760}
      header={<LessonHeader title={lesson.title} week={week} current={finished ? total : checked.length} total={total} />}
      content={
        <LayoutContent padding={4}>
          {finished ? (
            <ResultView
              title={lesson.title}
              stats={[
                { label: '手順', value: `${total} / ${total}` },
                { label: '獲得', value: `+${XP_PER_LAB} XP` },
                { label: '連続', value: `${currentStreak(progress, new Date())} 日` },
              ]}
              progress={progress}
              rows={[]}
              week={week}
            />
          ) : (
            <VStack gap={5}>
              <VStack gap={1}>
                <Text type="supporting">実習 · 家のクラスタ (k3s) で動かす</Text>
                <Heading level={2}>{lesson.title}</Heading>
              </VStack>
              <CheckboxList label="手順" description="1 つずつ動かし、できたら印を付けます" value={checked} onChange={setChecked} hasDividers>
                {lesson.steps.map((s, i) => (
                  <CheckboxListItem
                    key={i}
                    value={String(i)}
                    label={`${i + 1}. ${s.text}`}
                    description={s.command ? <Code>{s.command}</Code> : undefined}
                  />
                ))}
              </CheckboxList>
              <Text type="supporting">
                出典:{' '}
                <Link href={lesson.source} isExternalLink newTabLabel="(新しいタブで開きます)">
                  {new URL(lesson.source).hostname}
                </Link>
              </Text>
              <HStack justify="end">
                <Button variant="primary" label="完了にする" isDisabled={!allDone} onClick={finish} />
              </HStack>
            </VStack>
          )}
        </LayoutContent>
      }
    />
  );
}

function ResultView({
  title,
  stats,
  progress,
  rows,
  week,
  onRetry,
}: {
  title: string;
  stats: { label: string; value: string }[];
  progress: Progress;
  rows: { id: string; label: string; correct: boolean | undefined }[];
  week: number;
  onRetry?: () => void;
}) {
  const today = todayXp(progress, new Date());
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{title}</Text>
        <Heading level={1}>レッスン完了</Heading>
      </VStack>

      <HStack gap={8} wrap="wrap">
        {stats.map((s) => (
          <VStack key={s.label} gap={0.5}>
            <Text type="supporting">{s.label}</Text>
            <Text type="large">{s.value}</Text>
          </VStack>
        ))}
      </HStack>

      <ProgressBar
        label={today >= DAILY_GOAL_XP ? '今日の目標を達成' : '今日の目標'}
        value={Math.min(today, DAILY_GOAL_XP)}
        max={DAILY_GOAL_XP}
        hasValueLabel
        formatValueLabel={() => `${today} / ${DAILY_GOAL_XP} XP`}
        variant={today >= DAILY_GOAL_XP ? 'success' : 'accent'}
      />

      {rows.length > 0 && (
        <List hasDividers edge="outset" header={<Heading level={2}>問題ごとの結果</Heading>}>
          {rows.map((r) => (
            <ListItem
              key={r.id}
              label={r.label}
              startContent={<StatusDot variant={r.correct ? 'success' : 'error'} label={r.correct ? '正解' : '不正解'} />}
              endContent={<Text type="supporting">{r.correct ? '正解' : '見直す'}</Text>}
            />
          ))}
        </List>
      )}

      <HStack gap={2} justify="end" wrap="wrap">
        {onRetry && <Button label="もう一度解く" onClick={onRetry} />}
        <Button variant="primary" label="一覧へ戻る" href={weekHref(week)} />
      </HStack>
    </VStack>
  );
}
