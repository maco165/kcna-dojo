import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { LazyPart } from '../components/LoadBoundary';
import Crumbs from '../components/Crumbs';
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
import { FlagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FlagIcon as FlagSolidIcon } from '@heroicons/react/24/solid';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import AppSideNav from '../components/AppSideNav';
import AskAi from '../components/AskAi';
import BottomTabs from '../components/BottomTabs';
import Feedback from '../components/Feedback';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { questionBank } from '../content/lessons';
import type { Domain, Question } from '../content/types';
import { EXAM_MINUTES, EXAM_WEIGHTS, PASS_MARK, PASS_NOTE, confirmText, domainCounts, questionNavLabel, examIntro, formatClock, gradeExam, isAnswered, isCorrect, defaultChoice, lastExamOf, recordExam, startExam, type ExamChoice, type ExamSet, type BankItem, type ExamAnswer, type ExamResult, weakDomains } from '../lib/exam';
import examSets from '../content/examSets.json';
import { EXAM_ONLY } from '../content/examBank';
import { normalizeAnswer } from '../lib/grade';
import { clearExam, finishExam, isExpired, loadExam, markCount, newExamId, saveExam, type ExamProgress } from '../lib/examSave';
import type { Progress } from '../lib/progress';
import { SITE_NAME } from '../lib/site';
import ShareButton from '../components/ShareButton';
import { examShareText, shareUrl } from '../lib/share';
import { examHref } from '../lib/route';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

// 弱い分野の読み直す先 (ハンドブックのデータ) は、結果を出すときに読む
const WeakDomains = lazy(() => import('../components/WeakDomains'));
const ReadMore = lazy(() => import('../components/ReadMore'));

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
      <BottomTabs current="exam" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}

const EXAM_SETS = (examSets as { sets: ExamSet[] }).sets;
/** 決まった回が引く束: レッスンの問題と、模擬試験用の初見の問題 (ランダムはレッスンの問題だけから選ぶ) */
const setBank = () => [...questionBank(), ...EXAM_ONLY];
/** 初見の問題だけでできた回 */
const FRESH_SETS = EXAM_SETS.filter((s) => s.questions.every((id) => id.startsWith('x-'))).map((s) => s.id);
const choiceName = (c: ExamChoice) => (c === 'random' ? 'ランダム' : `第 ${c} 回`);

/** 選んだ回は ExamScreen が持つ (解き終えて戻っても、選んでいた回のまま) */
function Intro({
  progress,
  choice: picked,
  onChoice,
  onStart,
  saved,
  onResume,
  onDiscard,
}: {
  progress: Progress;
  choice: ExamChoice;
  onChoice: (c: ExamChoice) => void;
  onStart: (c: ExamChoice) => void;
  /** 途中で閉じた模擬試験 (再読み込み・開き直し)。あれば続きから解くかを先に聞く */
  saved?: ExamProgress | null;
  onResume?: () => void;
  onDiscard?: () => void;
}) {
  const counts = domainCounts();
  const bankSize = questionBank().length;
  const choice = String(picked);
  const setChoice = (v: string) => onChoice(v === 'random' ? 'random' : Number(v));
  const last = (id: number) => lastExamOf(progress.exams, id);
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Crumbs items={[{ name: '模擬試験' }]} />
        <h1 className="week-title">模擬試験</h1>
        <Text type="supporting">{examIntro(EXAM_SETS.length, FRESH_SETS, bankSize)}</Text>
      </VStack>
      {saved && onResume && onDiscard && (
        <Banner
          status="info"
          title={`途中の${choiceName(saved.set ?? 'random')}があります`}
          description={`${saved.items.length} 問のうち ${saved.answers.filter(isAnswered).length} 問に答えています。残り ${formatClock((saved.endsAt - Date.now()) / 1000)} (閉じている間も時間は進みます)。`}
          collapsible={false}
          endContent={
            <HStack gap={2} wrap="wrap">
              <Button variant="primary" label="続きから解く" onClick={onResume} />
              <Button label="やめて最初から" onClick={onDiscard} />
            </HStack>
          }
        />
      )}
      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">出る問題の数</h2>
          <List hasDividers edge="flush">
            {(Object.keys(EXAM_WEIGHTS) as Domain[]).map((d) => (
              <ListItem key={d} label={d} endContent={<Text type="supporting">{`配点 ${EXAM_WEIGHTS[d]}% · ${counts[d]} 問`}</Text>} />
            ))}
          </List>
          <Text type="supporting">{PASS_NOTE}</Text>
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
            <RadioListItem value="random" label="ランダム" description="毎回、第 1〜8 週の問題から選び直します" />
          </RadioList>
          <HStack>
            <Button variant="primary" label={`${choiceName(picked)}を始める`} onClick={() => onStart(picked)} />
          </HStack>
        </VStack>
      </Card>
      {progress.exams && progress.exams.length > 0 && (
        <List hasDividers edge="flush" header={<h2 className="h-sm">これまでの結果</h2>}>
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

function Running({
  examId,
  items,
  set,
  resume,
  onFinish,
  onQuit,
}: {
  /** 回ごとの id (保存と、採点した回の記録に使う) */
  examId: string;
  items: BankItem[];
  set?: number;
  /** 続きから解くときの答え・いまの問題・期限 */
  resume?: ExamProgress | null;
  onFinish: (answers: ExamAnswer[]) => void;
  onQuit: () => void;
}) {
  const [index, setIndex] = useState(() => resume?.index ?? 0);
  const [answers, setAnswers] = useState<ExamAnswer[]>(() => resume?.answers ?? items.map(() => undefined));
  const [marks, setMarks] = useState<boolean[]>(() => items.map((_, i) => resume?.marks?.[i] ?? false));
  const [showList, setShowList] = useState(false);
  const [endsAt] = useState(() => resume?.endsAt ?? Date.now() + EXAM_MINUTES * 60 * 1000);
  const [left, setLeft] = useState(() => (endsAt - Date.now()) / 1000);
  // 答えるたび・問題を移るたびに保存する (再読み込みや開き直しで続きから解けるように)。
  // 一度書いたあとは、保存がまだ自分の回のときだけ書き直す (ほかのタブが採点して消した保存を戻さない)
  const wrote = useRef(false);
  useEffect(() => {
    if (saveExam({ id: examId, set, items, answers, index, endsAt, marks }, undefined, { onlyIfCurrent: wrote.current })) wrote.current = true;
  }, [examId, set, items, answers, index, endsAt, marks]);
  const [confirm, setConfirm] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const answered = answers.filter(isAnswered).length;
  const marked = markCount(marks);
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
  const goTo = (i: number) => {
    setIndex(i);
    setShowList(false);
    window.scrollTo(0, 0);
  };

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
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <Text type="supporting">{item.domain}</Text>
            <ToggleButton
              size="sm"
              label="あとで見直す"
              icon={<FlagIcon width={16} height={16} />}
              pressedIcon={<FlagSolidIcon width={16} height={16} />}
              isPressed={marks[index]}
              onPressedChange={(v) => setMarks((prev) => prev.map((m, i) => (i === index ? v : m)))}
            />
          </HStack>
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
          <VStack gap={3}>
            <div>
              <Button
                variant="ghost"
                label={`${showList ? '問題の一覧を閉じる' : '問題の一覧'} (未回答 ${items.length - answered} · 印 ${marked})`}
                onClick={() => setShowList((v) => !v)}
              />
            </div>
            {showList && (
              <nav aria-label="問題の一覧" className="exam-nav">
                <ol className="exam-nav__grid">
                  {items.map((_, i) => {
                    const done = isAnswered(answers[i]);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          className={`exam-nav__item${done ? ' exam-nav__item--done' : ''}${marks[i] ? ' exam-nav__item--marked' : ''}`}
                          aria-label={questionNavLabel(i, done, marks[i], i === index)}
                          aria-current={i === index ? 'step' : undefined}
                          title={questionNavLabel(i, done, marks[i], i === index)}
                          onClick={() => goTo(i)}
                        >
                          {i + 1}
                          {marks[i] && <FlagSolidIcon width={10} height={10} aria-hidden="true" className="exam-nav__flag" />}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <Text type="supporting">塗りは回答済み、枠だけは未回答、旗は見直す印。押すとその問題へ移ります。</Text>
              </nav>
            )}
          </VStack>
        </VStack>
      </main>
      <AlertDialog
        isOpen={confirm}
        onOpenChange={(open) => {
          setConfirm(open);
          // 「続ける」で戻ったら、未回答か印があれば一覧を開いておく
          if (!open && (answered < items.length || marked > 0)) setShowList(true);
        }}
        title="採点しますか?"
        description={confirmText(items.length, answered, marked)}
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
          <LazyPart>
            <WeakDomains domains={weakDomains(result)} />
          </LazyPart>
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
                  <Feedback correct={false} correctAnswer={correctAnswer} explanation={q.explanation} note={q.type === 'choice' ? q.choices.find((c) => c.id === answer)?.why : q.wrongNotes?.[normalizeAnswer(answer ?? '')]} source={q.source} question={q} notesOpen={false} />
                  <LazyPart>
                    <ReadMore question={q} domain={item.domain} />
                  </LazyPart>
                  <AskAi question={q} answered={isAnswered(answer) ? { picked: answer, correct: false } : undefined} />
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
      <HStack gap={2} justify="between" vAlign="start" wrap="wrap">
        <ShareButton data={{ text: examShareText(result.correct, result.total), url: shareUrl(examHref) }} />
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
  // 途中で閉じた模擬試験 (問題は決まった回の束から引き直す。ランダムの問題も同じ束に入っている)
  const [saved, setSaved] = useState<ExamProgress | null>(() => loadExam(setBank()));
  const [resume, setResume] = useState<ExamProgress | null>(null);
  const [examId, setExamId] = useState('');
  const start = (c: ExamChoice) => {
    // 案内を開いている間に期限を過ぎた途中の回は、上書きする前に時間切れで記録する
    if (saved && isExpired(saved, Date.now()) && finishExam(saved.id)) updateProgress((p) => recordExam(p, saved.items, saved.answers, new Date(), saved.set));
    const next = startExam(c, EXAM_SETS, c === 'random' ? questionBank() : setBank());
    setExamId(newExamId());
    setSet(next.set);
    setItems(next.items);
    setAnswers([]);
    setResume(null);
    setSaved(null);
    setPhase('running');
    window.scrollTo(0, 0);
  };

  const finish = (final: ExamAnswer[], done: { id: string; items: BankItem[]; set?: number } = { id: examId, items, set }) => {
    const now = new Date();
    // ほかのタブでもう採点した回なら、記録をもう一度付けない (結果は出す)
    if (finishExam(done.id)) updateProgress((p) => recordExam(p, done.items, final, now, done.set));
    setItems(done.items);
    setSet(done.set);
    setAnswers(final);
    setSaved(null);
    setPhase('result');
    window.scrollTo(0, 0);
  };

  // 閉じている間に期限を過ぎていたら、続きからではなく時間切れの結果にする (記録は 1 回だけ)。
  // 案内を開いたまま期限が来たときも、期限の時刻に張った時計で同じにする
  const expiredDone = useRef(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!saved || expiredDone.current) return;
    const rest = saved.endsAt - Date.now();
    if (rest > 0) {
      const id = window.setTimeout(() => setTick((t) => t + 1), Math.min(rest + 50, 2 ** 31 - 1));
      return () => window.clearTimeout(id);
    }
    expiredDone.current = true;
    finish(saved.answers, { id: saved.id, items: saved.items, set: saved.set });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, tick]);

  const resumeSaved = () => {
    if (!saved) return;
    if (isExpired(saved, Date.now())) {
      finish(saved.answers, { id: saved.id, items: saved.items, set: saved.set });
      return;
    }
    setSet(saved.set);
    setItems(saved.items);
    setExamId(saved.id);
    setResume(saved);
    setSaved(null);
    setPhase('running');
    window.scrollTo(0, 0);
  };
  const discardSaved = () => {
    clearExam();
    setSaved(null);
  };
  const quit = () => {
    clearExam();
    setResume(null);
    setPhase('intro');
  };

  if (phase === 'running') return <Running examId={examId} items={items} set={set} resume={resume} onFinish={(a) => finish(a)} onQuit={quit} />;
  return (
    <Frame progress={progress}>
      {phase === 'result' && result ? (
        <Result items={items} answers={answers} result={result} onRestart={() => setPhase('intro')} />
      ) : (
        <Intro progress={progress} choice={choice} onChoice={setChoice} onStart={start} saved={saved && !isExpired(saved, Date.now()) ? saved : null} onResume={resumeSaved} onDiscard={discardSaved} />
      )}
    </Frame>
  );
}
