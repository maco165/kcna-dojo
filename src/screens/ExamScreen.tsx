import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { XMarkIcon } from '@heroicons/react/24/outline';
import AppSideNav from '../components/AppSideNav';
import AskAi from '../components/AskAi';
import BottomTabs from '../components/BottomTabs';
import Feedback from '../components/Feedback';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueQuestions, questionBank } from '../content';
import type { Domain, Question } from '../content/types';
import {
  EXAM_MINUTES,
  EXAM_QUESTIONS,
  EXAM_WEIGHTS,
  PASS_MARK,
  domainCounts,
  formatClock,
  gradeExam,
  isAnswered,
  isCorrect,
  defaultChoice,
  lastExamOf,
  recordExam,
  startExam,
  type ExamChoice,
  type ExamSet,
  type BankItem,
  type ExamAnswer,
  type ExamResult,
} from '../lib/exam';
import examSets from '../content/examSets.json';
import { normalizeAnswer } from '../lib/grade';
import type { Progress } from '../lib/progress';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Props = { progress: Progress; updateProgress: (fn: (p: Progress) => Progress) => void };

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Frame({ progress, children }: { progress: Progress; children: React.ReactNode }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="exam" progress={progress} />}>
        <div className="desk">
          <div className="about">{children}</div>
        </div>
      </AppShell>
    );
  }
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar__brand">
          <SiteLogo />
          <Text type="large">{SITE_NAME}</Text>
        </span>
        <RepoLink />
      </header>
      <main className="page__section">{children}</main>
      <BottomTabs current="exam" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}

const EXAM_SETS = (examSets as { sets: ExamSet[] }).sets;
const choiceName = (c: ExamChoice) => (c === 'random' ? 'ランダム' : `第 ${c} 回`);

/** 選んだ回は ExamScreen が持つ (解き終えて戻っても、選んでいた回のまま) */
function Intro({ progress, choice: picked, onChoice, onStart }: { progress: Progress; choice: ExamChoice; onChoice: (c: ExamChoice) => void; onStart: (c: ExamChoice) => void }) {
  const counts = domainCounts();
  const bankSize = questionBank().length;
  const choice = String(picked);
  const setChoice = (v: string) => onChoice(v === 'random' ? 'random' : Number(v));
  const last = (id: number) => lastExamOf(progress.exams, id);
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">模擬試験</h1>
        <Text type="supporting">
          第 1〜8 週の問題 ({bankSize} 問) から、本番と同じ 4 分野の配点の割合で {EXAM_QUESTIONS} 問を出します。問題が決まっていて互いに重ならない第 1〜{EXAM_SETS.length} 回と、毎回選び直すランダムがあります。時間は {EXAM_MINUTES} 分で、途中では答えを見せず、最後にまとめて採点します。
        </Text>
      </VStack>
      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">出る問題の数</h2>
          <List hasDividers>
            {(Object.keys(EXAM_WEIGHTS) as Domain[]).map((d) => (
              <ListItem key={d} label={d} endContent={<Text type="supporting">{`配点 ${EXAM_WEIGHTS[d]}% · ${counts[d]} 問`}</Text>} />
            ))}
          </List>
          <Text type="supporting">合格の目安は {Math.round(PASS_MARK * 100)}% としています (LF の多肢選択式試験に共通の合格点です)。答えて間違えた問題は復習に入ります。</Text>
          <RadioList label="回を選ぶ" value={choice} onChange={setChoice}>
            {EXAM_SETS.map((set) => {
              const e = last(set.id);
              return (
                <RadioListItem
                  key={set.id}
                  value={String(set.id)}
                  label={choiceName(set.id)}
                  description={e ? `前回 ${e.correct} / ${e.total} (${pct(e.correct, e.total)}%)` : 'まだ解いていません'}
                />
              );
            })}
            <RadioListItem value="random" label="ランダム" description="毎回、全問から選び直します" />
          </RadioList>
          <HStack>
            <Button variant="primary" label={`${choiceName(picked)}を始める`} onClick={() => onStart(picked)} />
          </HStack>
        </VStack>
      </Card>
      {progress.exams && progress.exams.length > 0 && (
        <List hasDividers header={<h2 className="h-sm">これまでの結果</h2>}>
          {progress.exams.map((e, i) => (
            <ListItem
              key={`${e.at}-${i}`}
              label={`${e.set ? choiceName(e.set) : 'ランダム'} · ${e.correct} / ${e.total} (${pct(e.correct, e.total)}%)`}
              description={new Date(e.at).toLocaleString('ja-JP')}
              startContent={
                <StatusDot variant={e.correct / e.total >= PASS_MARK ? 'success' : 'warning'} label={e.correct / e.total >= PASS_MARK ? '目安に届いた' : '目安に届かない'} />
              }
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

function ExamQuestion({ question, answer, onAnswer }: { question: Question; answer: ExamAnswer; onAnswer: (a: string) => void }) {
  if (question.type === 'choice') {
    return (
      <VStack gap={4}>
        <h1 className="q-title">{question.prompt}</h1>
        {question.code && <CodeBlock code={question.code.text} language={question.code.language} width="100%" size="sm" hasCopyButton={false} />}
        <RadioList label="選択肢" isLabelHidden value={answer ?? ''} onChange={onAnswer}>
          {question.choices.map((c, i) => (
            <RadioListItem key={c.id} value={c.id} label={`${String.fromCharCode(65 + i)}. ${c.text}`} />
          ))}
        </RadioList>
      </VStack>
    );
  }
  const [before, after] = question.code.split('{{blank}}');
  return (
    <VStack gap={4}>
      <h1 className="q-title">{question.prompt}</h1>
      <div className="fill-code">
        <div className="fill-code__header">
          <Text type="supporting">{question.language === 'dockerfile' ? 'Dockerfile' : question.language}</Text>
        </div>
        <div className="fill-code__body">
          {question.language === 'bash' && <span className="fill-code__prompt">$ </span>}
          {before}
          <span className="fill-code__blank" style={{ width: 'calc(16ch + 24px)' }}>
            <TextInput
              label="空欄"
              isLabelHidden
              size="sm"
              value={answer ?? ''}
              onChange={(v) => onAnswer(v)}
              placeholder="____"
              autoCapitalize="off"
              hasAutoCorrect={false}
              hasSpellCheck={false}
              autoComplete="off"
              width="100%"
            />
          </span>
          {after}
        </div>
      </div>
      {question.candidates && (
        <HStack gap={2} wrap="wrap">
          {question.candidates.map((c) => (
            <Button key={c} label={c} variant={normalizeAnswer(answer ?? '') === c ? 'primary' : 'secondary'} onClick={() => onAnswer(c)} />
          ))}
        </HStack>
      )}
    </VStack>
  );
}

function Running({ items, onFinish, onQuit }: { items: BankItem[]; onFinish: (answers: ExamAnswer[]) => void; onQuit: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>(() => items.map(() => undefined));
  const [endsAt] = useState(() => Date.now() + EXAM_MINUTES * 60 * 1000);
  const [left, setLeft] = useState(EXAM_MINUTES * 60);
  const [confirm, setConfirm] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const answered = answers.filter(isAnswered).length;
  // 時計は答えの変化で張り直さない。時間切れのときは最新の答えで採点する
  const latest = useRef({ answers, onFinish });
  latest.current = { answers, onFinish };

  useEffect(() => {
    const id = window.setInterval(() => {
      const rest = (endsAt - Date.now()) / 1000;
      setLeft(rest);
      if (rest <= 0) {
        window.clearInterval(id);
        latest.current.onFinish(latest.current.answers);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const item = items[index];
  const setAnswer = (a: string) => setAnswers((prev) => prev.map((x, i) => (i === index ? a : x)));
  const isLast = index === items.length - 1;

  return (
    <div className="lesson">
      <header className="lesson-bar">
        <Button variant="ghost" label="模擬試験をやめる" isIconOnly icon={<XMarkIcon width={20} height={20} />} onClick={() => setConfirmQuit(true)} />
        <div className="lesson-bar__progress">
          <HStack justify="between">
            <Text type="supporting">
              模擬試験 · {index + 1} / {items.length} 問 · 答えた {answered}
            </Text>
            <Text type="supporting" weight="semibold">
              残り {formatClock(left)}
            </Text>
          </HStack>
          <ProgressBar label="模擬試験の進み具合" isLabelHidden value={index + 1} max={items.length} />
        </div>
      </header>
      <main className="lesson__main">
        <VStack gap={5}>
          <Text type="supporting">{item.domain}</Text>
          <ExamQuestion key={item.question.id} question={item.question} answer={answers[index]} onAnswer={setAnswer} />
          <HStack gap={2} justify="between" wrap="wrap">
            <Button label="前へ" isDisabled={index === 0} onClick={() => setIndex((i) => i - 1)} />
            {isLast ? (
              <Button variant="primary" label="採点する" onClick={() => setConfirm(true)} />
            ) : (
              <HStack gap={2}>
                <Button variant="ghost" label="採点する" onClick={() => setConfirm(true)} />
                <Button variant="primary" label="次へ" onClick={() => setIndex((i) => i + 1)} />
              </HStack>
            )}
          </HStack>
        </VStack>
      </main>
      <AlertDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title="採点しますか?"
        description={answered < items.length ? `まだ答えていない問題が ${items.length - answered} 問あります。答えていない問題は不正解になります。` : 'すべての問題に答えました。'}
        actionLabel="採点する"
        actionVariant="primary"
        cancelLabel="続ける"
        onAction={() => {
          setConfirm(false);
          onFinish(answers);
        }}
      />
      <AlertDialog
        isOpen={confirmQuit}
        onOpenChange={setConfirmQuit}
        title="模擬試験をやめますか?"
        description="やめると、ここまでの答えは残らず、採点もしません。"
        actionLabel="やめる"
        cancelLabel="続ける"
        onAction={() => {
          setConfirmQuit(false);
          onQuit();
        }}
      />
    </div>
  );
}

function Result({ items, answers, result, onRestart }: { items: BankItem[]; answers: ExamAnswer[]; result: ExamResult; onRestart: () => void }) {
  const rate = result.correct / result.total;
  const wrong = items.map((item, i) => ({ item, answer: answers[i] })).filter(({ item, answer }) => !isCorrect(item.question, answer));
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME} · 模擬試験</Text>
        <h1 className="week-title">結果</h1>
      </VStack>
      <Banner
        status={rate >= PASS_MARK ? 'success' : 'warning'}
        title={`${result.correct} / ${result.total} 問 (${pct(result.correct, result.total)}%)`}
        description={rate >= PASS_MARK ? `合格の目安 ${Math.round(PASS_MARK * 100)}% に届きました。` : `合格の目安 ${Math.round(PASS_MARK * 100)}% まで、あと ${Math.ceil(PASS_MARK * result.total) - result.correct} 問です。`}
        collapsible={false}
      />
      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">分野ごとの正答率</h2>
          {(Object.keys(result.byDomain) as Domain[]).map((d) => {
            const r = result.byDomain[d];
            return (
              <ProgressBar
                key={d}
                label={`${d} (${r.right} / ${r.total})`}
                value={pct(r.right, r.total)}
                hasValueLabel
                formatValueLabel={(v) => `${v}%`}
                variant={r.total > 0 && r.right / r.total >= PASS_MARK ? 'success' : 'warning'}
              />
            );
          })}
        </VStack>
      </Card>
      {wrong.length > 0 && (
        <VStack gap={4}>
          <VStack gap={1}>
            <h2 className="h-sm">間違えた・答えなしの問題 ({wrong.length})</h2>
            <Text type="supporting">
              答えて間違えた {wrong.filter((w) => isAnswered(w.answer)).length} 問は復習に入りました。答えなしの問題は記録しません。
            </Text>
          </VStack>
          {wrong.map(({ item, answer }) => {
            const q = item.question;
            const correctAnswer =
              q.type === 'fill' ? q.answers[0] : String.fromCharCode(65 + q.choices.findIndex((c) => c.id === q.answer));
            const mine =
              !isAnswered(answer)
                ? '(答えなし)'
                : q.type === 'fill'
                  ? answer
                  : String.fromCharCode(65 + q.choices.findIndex((c) => c.id === answer));
            return (
              <Card key={q.id} padding={4}>
                <VStack gap={3}>
                  <Text type="supporting">{item.domain}</Text>
                  <Text weight="semibold">{q.prompt}</Text>
                  {q.type === 'choice' && (
                    <VStack gap={1}>
                      {q.choices.map((c, i) => (
                        <Text key={c.id}>{`${String.fromCharCode(65 + i)}. ${c.text}`}</Text>
                      ))}
                    </VStack>
                  )}
                  {q.type === 'fill' && <CodeBlock code={q.code.replace('{{blank}}', '____')} width="100%" size="sm" hasCopyButton={false} />}
                  <Text type="supporting">あなたの答え: {mine}</Text>
                  <Feedback correct={false} correctAnswer={correctAnswer} explanation={q.explanation} note={q.type === 'choice' ? q.choices.find((c) => c.id === answer)?.why : q.wrongNotes?.[normalizeAnswer(answer ?? '')]} source={q.source} />
                  <AskAi question={q} answered={isAnswered(answer) ? { picked: answer, correct: false } : undefined} />
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
      <HStack gap={2} justify="end" wrap="wrap">
        <Button variant="primary" label="模擬試験の最初へ戻る" onClick={onRestart} />
      </HStack>
    </VStack>
  );
}

export default function ExamScreen({ progress, updateProgress }: Props) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'result'>('intro');
  const [items, setItems] = useState<BankItem[]>([]);
  const [set, setSet] = useState<number | undefined>(undefined);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const result = useMemo(() => (phase === 'result' ? gradeExam(items, answers) : null), [phase, items, answers]);

  const [choice, setChoice] = useState<ExamChoice>(() => defaultChoice(progress.exams, EXAM_SETS));
  const start = (c: ExamChoice) => {
    const next = startExam(c, EXAM_SETS, questionBank());
    setSet(next.set);
    setItems(next.items);
    setAnswers([]);
    setPhase('running');
    window.scrollTo(0, 0);
  };

  const finish = (final: ExamAnswer[]) => {
    const now = new Date();
    updateProgress((p) => recordExam(p, items, final, now, set));
    setAnswers(final);
    setPhase('result');
    window.scrollTo(0, 0);
  };

  if (phase === 'running') return <Running items={items} onFinish={finish} onQuit={() => setPhase('intro')} />;
  return (
    <Frame progress={progress}>
      {phase === 'result' && result ? (
        <Result items={items} answers={answers} result={result} onRestart={() => setPhase('intro')} />
      ) : (
        <Intro progress={progress} choice={choice} onChoice={setChoice} onStart={start} />
      )}
    </Frame>
  );
}
