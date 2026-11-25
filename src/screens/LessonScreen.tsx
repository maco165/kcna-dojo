import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AskAiLinks } from '../components/AskAi';
import ChoiceQuestionView from '../components/ChoiceQuestionView';
import FillQuestionView from '../components/FillQuestionView';
import { ActionArea, PrimaryAction, QuestionHead, QuestionHeadingLevel } from '../components/QuestionFrame';
import type { LabLesson, Lesson, Question, QuizLesson } from '../content/types';
import { labStepText } from '../lib/askAi';
import { XP_PER_CORRECT, XP_PER_LAB } from '../lib/grade';
import { answerHistory, completeLesson, currentStreak, goalXp, recordAnswer, todayXp, type Progress } from '../lib/progress';
import { shuffleChoices } from '../lib/shuffle';
import { COVERED_LEAD, COVERED_REST, chapterNo, chaptersOfLab } from '../content/coveredLabs';
import { WEEKS } from '../content/curriculum';
import { handbookHref, handsOnHref, lessonHref, weekHref } from '../lib/route';
import ShareButton from '../components/ShareButton';
import { lessonShareText, shareUrl, type ShareData } from '../lib/share';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Props = {
  lesson: Lesson;
  week: number;
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
};

/** 上の帯: 閉じる・レッスン名と何問目か・進み具合 */
function LessonBar({
  title,
  closeHref,
  onClose,
  current,
  total,
  unit,
}: {
  title: string;
  closeHref: string;
  onClose?: () => void;
  current: number;
  total: number;
  unit: string;
}) {
  return (
    <header className="lesson-bar">
      <Button variant="ghost" label="レッスンを閉じる" isIconOnly icon={<XMarkIcon width={20} height={20} />} href={onClose ? undefined : closeHref} onClick={onClose} />
      <div className="lesson-bar__progress">
        {/* レッスン名がこの画面の h1 (書き出す HTML の h1 と同じ)。見た目は補足の字のまま。問題文はその下の h2 */}
        <div className="lesson-bar__label">
          <h1 className="lesson-bar__title">{title}</h1> · {current} / {total} {unit}
        </div>
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
  return (
    <QuestionRun
      title={lesson.title}
      resultLabel={`第 ${week} 週 · ${lesson.id.replace(/^w\d+-/, '')} ${lesson.title}`}
      questions={lesson.questions}
      domainOf={() => lesson.domain}
      closeHref={weekHref(week)}
      backHref={weekHref(week)}
      progress={progress}
      updateProgress={updateProgress}
      canRetry
      shareOf={(correct, total) => ({ text: lessonShareText(correct, total), url: shareUrl(lessonHref(lesson.id)) })}
      onFinish={(p, correct, total) => completeLesson(p, lesson.id, { correct, total }, correct * XP_PER_CORRECT, new Date())}
    />
  );
}

/** 問題を 1 問ずつ解いて、最後に結果を出す流れ。レッスンと復習で共通 */
export function QuestionRun({
  title,
  resultLabel,
  questions: source,
  domainOf,
  closeHref,
  backHref,
  progress,
  updateProgress,
  canRetry,
  onBack,
  onClose,
  onCorrect,
  onFinish,
  shareOf,
}: {
  title: string;
  resultLabel: string;
  questions: Question[];
  domainOf: (q: Question) => string;
  closeHref: string;
  backHref: string;
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
  canRetry?: boolean;
  /** 結果の画面の「一覧へ戻る」で、URL を変えずに戻すとき (同じ URL の画面から始めた復習など) */
  onBack?: () => void;
  /** 上の × で、URL を変えずに閉じるとき */
  onClose?: () => void;
  /** 正解のたびに進捗に反映する (復習の XP など) */
  onCorrect?: (p: Progress) => Progress;
  /** 最後の問題のあと、進捗に反映する (XP・完了など) */
  onFinish: (p: Progress, correct: number, total: number) => Progress;
  /** 結果の画面の「共有」に渡す文と URL (点数と URL だけ)。無ければ共有を出さない (復習など) */
  shareOf?: (correct: number, total: number) => ShareData;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  // 解いた記録は、始めたときのものを出す (答えるたびに数が変わると、どの回の話か分かりにくい)
  const [before, setBefore] = useState(() => progress.answers);
  // 4 択の選択肢は、開いたときと「もう一度解く」のたびに混ぜ直す (attempt が変わるたび)
  const questions = useMemo(() => source.map((question) => shuffleChoices(question)), [source, attempt]);
  const total = questions.length;
  const q = questions[index];
  const isLast = index === total - 1;

  const onChecked = (correct: boolean) => {
    setResults((r) => [...r, correct]);
    updateProgress((p) => {
      const recorded = recordAnswer(p, q.id, correct, new Date());
      return correct && onCorrect ? onCorrect(recorded) : recorded;
    });
  };

  const onNext = useCallback(() => {
    if (!isLast) {
      setIndex((i) => i + 1);
      window.scrollTo(0, 0);
      return;
    }
    const correct = results.filter(Boolean).length;
    updateProgress((p) => onFinish(p, correct, total));
    setElapsed(Date.now() - startedAt);
    setFinished(true);
    window.scrollTo(0, 0);
  }, [isLast, results, updateProgress, onFinish, total, startedAt]);

  const restart = () => {
    // もう一度解くときは、1 回目に答えた分を入れた記録から出す
    setBefore(progress.answers);
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
        backHref={backHref}
        onBack={onBack}
        lessonLabel={resultLabel}
        stats={[
          { label: '正答', value: `${correct} / ${total}` },
          { label: '獲得', value: `+${correct * XP_PER_CORRECT} XP` },
          { label: '時間', value: formatDuration(elapsed) },
        ]}
        progress={progress}
        rows={questions.map((question, i) => ({ id: question.id, label: question.prompt, correct: results[i], history: answerHistory(progress.answers[question.id]) }))}
        onRetry={canRetry ? restart : undefined}
        share={shareOf?.(correct, total)}
      />
    );
  }

  const nextLabel = isLast ? '結果を見る' : '次へ';
  return (
    <div className="lesson">
      <LessonBar title={title} closeHref={closeHref} onClose={onClose} current={index + 1} total={total} unit="問" />
      <main className="lesson__main">
        <QuestionHeadingLevel.Provider value={2}>
        {q.type === 'fill' ? (
          <FillQuestionView key={`${attempt}-${q.id}`} question={q} domain={domainOf(q)} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} history={answerHistory(before[q.id])} />
        ) : (
          <ChoiceQuestionView key={`${attempt}-${q.id}`} question={q} domain={domainOf(q)} onChecked={onChecked} nextLabel={nextLabel} onNext={onNext} history={answerHistory(before[q.id])} />
        )}
        </QuestionHeadingLevel.Provider>
      </main>
    </div>
  );
}

/** 章が覆った実習に出す、章へのリンク (頭と結果の画面) */
function CoveredNote({ labId }: { labId: string }) {
  const chapters = chaptersOfLab(labId);
  if (chapters.length === 0) return null;
  return (
    <p className="hb-lead">
      {COVERED_LEAD}{' '}
      {chapters.map((c, i) => (
        <Fragment key={c.id}>
          {i > 0 && '、'}
          <Link href={handsOnHref(c.id)}>{`${chapterNo(c)}「${c.title}」`}</Link>
        </Fragment>
      ))}
      {COVERED_REST[labId] && `。${COVERED_REST[labId]}`}
    </p>
  );
}

function LabRun({ lesson, week, progress, updateProgress }: Props & { lesson: LabLesson }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const total = lesson.steps.length;
  const allDone = checked.length === total;
  const read = WEEKS.find((w) => w.week === week)?.read ?? [];
  const finish = () => {
    updateProgress((p) => completeLesson(p, lesson.id, { correct: 1, total: 1 }, XP_PER_LAB, new Date()));
    setFinished(true);
    window.scrollTo(0, 0);
  };

  if (finished) {
    return (
      <ResultView
        backHref={handsOnHref()}
        lessonLabel={`第 ${week} 週 · ${lesson.title}`}
        stats={[
          { label: '手順', value: `${total} / ${total}` },
          { label: '獲得', value: `+${XP_PER_LAB} XP` },
          { label: '連続', value: `${currentStreak(progress, new Date())} 日` },
        ]}
        progress={progress}
        rows={[]}
        note={<CoveredNote labId={lesson.id} />}
        share={{ text: lessonShareText(total, total).replace('問正解', '手順'), url: shareUrl(lessonHref(lesson.id)) }}
      />
    );
  }

  return (
    <div className="lesson">
      <LessonBar title={lesson.title} closeHref={handsOnHref()} current={checked.length} total={total} unit="手順" />
      <main className="lesson__main">
        <VStack gap={5}>
          <QuestionHeadingLevel.Provider value={2}>
            <QuestionHead kind="実習 · 家のクラスタ (k3s) で動かす" domain={lesson.domain} prompt={lesson.title} />
          </QuestionHeadingLevel.Provider>
          <CoveredNote labId={lesson.id} />
          <section className="lab-prep" aria-labelledby="lab-prep-title">
            <h2 id="lab-prep-title" className="h-sm">
              始める前に
            </h2>
            <dl className="lab-prep__list">
              <dt>この実習で分かること</dt>
              <dd>{lesson.goal}</dd>
              <dt>用意するもの</dt>
              <dd>
                <ul>
                  {lesson.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <a href={handbookHref('setup-k3s')}>クラスタがまだ無い人は: k3s の入れ方</a>
              </dd>
              <dt>先に読む</dt>
              <dd className="lab-prep__chips">
                {read.map((r) => (
                  <a key={r.topic} className="gloss-chip" href={handbookHref(r.topic)}>
                    {r.label}
                  </a>
                ))}
              </dd>
            </dl>
          </section>
          <CheckboxList label="手順" description="上から順に 1 つずつ動かし、「うまくいくと」のとおりになったら印を付けます" value={checked} onChange={setChecked} hasDividers>
            {lesson.steps.map((s, i) => (
              <CheckboxListItem
                key={i}
                value={String(i)}
                label={`手順 ${i + 1}`}
                description={
                  <span className="lab-step">
                    {/* 文は切らずに全部出す (部品の label は 1 行で切れる)。コマンドは改行をそのまま出す (貼って動く形を崩さない) */}
                    <span className="lab-step__text">{s.text}</span>
                    {s.command && (
                      <code className="lab-step__code" translate="no">
                        {s.command}
                      </code>
                    )}
                    {s.expect && (
                      <span className="lab-step__note">
                        <span className="lab-step__tag lab-step__tag--ok">うまくいくと</span>
                        {s.expect}
                      </span>
                    )}
                    {s.stuck && (
                      <span className="lab-step__note">
                        <span className="lab-step__tag lab-step__tag--stuck">つまずいたら</span>
                        {s.stuck}
                      </span>
                    )}
                    <span className="lab-step__ask">
                      <AskAiLinks text={labStepText(lesson, i)} lead="AI に聞く" inDialog />
                    </span>
                  </span>
                }
              />
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
  backHref,
  onBack,
  lessonLabel,
  stats,
  progress,
  rows,
  onRetry,
  share,
  note,
}: {
  /** 問題ごとの結果の下、ボタンの上に出す文 (覆った実習の章へのリンク) */
  note?: ReactNode;
  share?: ShareData;
  backHref: string;
  onBack?: () => void;
  lessonLabel: string;
  stats: { label: string; value: string }[];
  progress: Progress;
  rows: { id: string; label: string; correct: boolean | undefined; history?: string }[];
  onRetry?: () => void;
}) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const now = new Date();
  const today = todayXp(progress, now);
  const goal = goalXp(progress);
  const reached = today >= goal;
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
          value={Math.min(today, goal)}
          max={goal}
          hasValueLabel
          formatValueLabel={() => `${today} / ${goal} XP · ${currentStreak(progress, now)} 日連続`}
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
                  description={r.history}
                  startContent={<StatusDot variant={r.correct ? 'success' : 'error'} label={r.correct ? '正解' : '不正解'} />}
                  endContent={<Text type="supporting">{r.correct ? '正解' : '復習へ'}</Text>}
                />
              ))}
            </List>
          </div>
        </>
      )}

      {note}

      <div className="result__actions">
        {share && (
          <div className="result__share">
            <ShareButton data={share} />
          </div>
        )}
        <HStack gap={2} justify={isWide ? 'end' : 'start'}>
          {onRetry && <Button label="もう一度解く" onClick={onRetry} width={isWide ? undefined : '100%'} size={isWide ? 'md' : 'lg'} />}
          <Button
            variant="primary"
            label="一覧へ戻る"
            href={onBack ? undefined : backHref}
            onClick={onBack}
            width={isWide ? undefined : '100%'}
            size={isWide ? 'md' : 'lg'}
          />
        </HStack>
      </div>
    </div>
  );
}
