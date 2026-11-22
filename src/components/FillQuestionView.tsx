import { lazy, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { LazyPart } from './LoadBoundary';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { FillQuestion } from '../content/types';
import { gradeFill, normalizeAnswer } from '../lib/grade';
import AskAi from './AskAi';
import Feedback from './Feedback';
import { ActionArea, PrimaryAction, QuestionHead } from './QuestionFrame';
import { preloadNotes } from '../lib/preloadNotes';

// 読み直す先 (ハンドブックと用語集) は、そのデータと一緒に答えたあとに読む
const ReadMore = lazy(() => import('./ReadMore'));

const LANGUAGE_LABEL: Record<FillQuestion['language'], string> = {
  bash: 'bash',
  yaml: 'yaml',
  dockerfile: 'Dockerfile',
};

const KIND_LABEL: Record<FillQuestion['language'], string> = {
  bash: 'コマンドの穴埋め',
  yaml: 'YAML の穴埋め',
  dockerfile: 'Dockerfile の穴埋め',
};

export default function FillQuestionView({
  question,
  domain,
  onChecked,
  nextLabel,
  onNext,
  history,
}: {
  question: FillQuestion;
  domain: string;
  onChecked: (correct: boolean) => void;
  nextLabel: string;
  onNext: () => void;
  /** この問題を解いた記録の 1 行 (このレッスンを始めたときのもの) */
  history?: string;
}) {
  // 答えたあとに出すコマンドの説明を、問題を開いたときに先に読む (答えてから読むと「次へ」が下へずれる)
  useEffect(preloadNotes, []);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const checked = result !== null;
  const typed = normalizeAnswer(value);
  const longest = Math.max(8, ...question.answers.map((a) => a.length), ...(question.candidates ?? []).map((c) => c.length));
  const lines = question.code.split('\n');

  const check = () => {
    if (checked || typed === '') return;
    const ok = gradeFill(question, value);
    setResult(ok);
    onChecked(ok);
  };

  // 答えたあとは Enter で次へ進む (PC の「Enter で確かめる・次へ」の案内と同じ動き)
  useEffect(() => {
    if (!checked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.repeat || e.defaultPrevented) return;
      // リンクやボタン (AI に聞く・次へ) の上の Enter は、それ自身の動きに任せる
      if (e.target instanceof Element && e.target.closest('a, button')) return;
      onNext();
    };
    const id = window.setTimeout(() => window.addEventListener('keydown', onKey), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [checked, onNext]);

  const blank = (
    <span className="fill-code__blank" style={{ width: `calc(${longest + 1}ch + 52px)` }}>
      <TextInput
        label="空欄"
        isLabelHidden
        size="sm"
        value={value}
        onChange={(v) => setValue(v)}
        onEnter={check}
        isReadOnly={checked}
        placeholder="____"
        autoCapitalize="off"
        hasAutoCorrect={false}
        hasSpellCheck={false}
        autoComplete="off"
        status={checked ? { type: result ? 'success' : 'error' } : undefined}
        width="100%"
      />
    </span>
  );

  return (
    <VStack gap={5}>
      <QuestionHead kind={KIND_LABEL[question.language]} domain={domain} prompt={question.prompt} history={history} />

      <div className="fill-code" data-testid="fill-code">
        <div className="fill-code__header">
          <Text type="supporting">{LANGUAGE_LABEL[question.language]}</Text>
          {question.language === 'bash' && <span className="caption-code">~/k3s</span>}
        </div>
        {lines.length > 1 ? (
          <div className="fill-code__body fill-code__body--lines">
            {lines.map((line, i) => {
              const [before, after] = line.split('{{blank}}');
              return (
                <div key={i} className="fill-code__line">
                  <span className="fill-code__ln" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    {before}
                    {after !== undefined && (
                      <>
                        {blank}
                        {after}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fill-code__body">
            {question.language === 'bash' && <span className="fill-code__prompt">$ </span>}
            {question.code.split('{{blank}}')[0]}
            {blank}
            {question.code.split('{{blank}}')[1]}
          </div>
        )}
      </div>

      {question.candidates && !checked && (
        <VStack gap={2}>
          <Text type="supporting">候補 (打っても、押しても入ります)</Text>
          <HStack gap={2} wrap="wrap">
            {question.candidates.map((c) => (
              <Button key={c} label={c} onClick={() => setValue(c)} variant={typed === c ? 'primary' : 'secondary'} />
            ))}
          </HStack>
        </VStack>
      )}

      <ActionArea>
        {!checked ? (
          <>
            <PrimaryAction label="確かめる" onClick={check} isDisabled={typed === ''} kbdHint="Enter で確かめる・次へ" />
            <AskAi question={question} />
          </>
        ) : (
          <>
            <Feedback
              correct={result}
              correctAnswer={question.answers[0]}
              explanation={question.explanation}
              note={result ? undefined : question.wrongNotes?.[typed]}
              source={question.source}
              question={question}
              extra={result && question.output ? <CodeBlock code={question.output} title="実行結果の例 (列の一部)" width="100%" size="sm" hasCopyButton={false} /> : undefined}
            />
            <PrimaryAction label={nextLabel} onClick={onNext} kbdHint="Enter で次へ" />
            <LazyPart>
              <ReadMore question={question} domain={domain} />
            </LazyPart>
            <AskAi question={question} answered={{ picked: typed, correct: result }} />
          </>
        )}
      </ActionArea>
    </VStack>
  );
}
