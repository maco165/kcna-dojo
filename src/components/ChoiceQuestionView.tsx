import { lazy, useEffect, useState } from 'react';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { LazyPart } from './LoadBoundary';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { VStack } from '@astryxdesign/core/Stack';
import type { ChoiceQuestion } from '../content/types';
import { gradeChoice } from '../lib/grade';
import AskAi from './AskAi';
import Feedback from './Feedback';
import { ActionArea, PrimaryAction, QuestionHead } from './QuestionFrame';
import { preloadNotes } from '../lib/preloadNotes';

// 読み直す先 (ハンドブックと用語集) は、そのデータと一緒に答えたあとに読む
const ReadMore = lazy(() => import('./ReadMore'));

export default function ChoiceQuestionView({
  question,
  domain,
  onChecked,
  nextLabel,
  onNext,
  history,
}: {
  question: ChoiceQuestion;
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
  const answerIndex = question.choices.findIndex((c) => c.id === question.answer);
  const answerLetter = String.fromCharCode(65 + answerIndex);
  const picked = question.choices.find((c) => c.id === value);

  const check = () => {
    if (checked || value === '') return;
    const ok = gradeChoice(question, value);
    setResult(ok);
    onChecked(ok);
  };

  return (
    <VStack gap={5}>
      <QuestionHead kind={question.code ? '出力を読む' : '4 択'} domain={domain} prompt={question.prompt} history={history} />

      {question.code && (
        <CodeBlock code={question.code.text} language={question.code.language} width="100%" size="sm" hasCopyButton={false} />
      )}

      <RadioList label="選択肢" isLabelHidden value={value} onChange={setValue} isDisabled={checked}>
        {question.choices.map((c, i) => (
          <RadioListItem key={c.id} value={c.id} label={`${String.fromCharCode(65 + i)}. ${c.text}`} align="first-line" endContent={result === false ? <ChoiceMark isAnswer={c.id === question.answer} isPicked={c.id === value} /> : undefined} />
        ))}
      </RadioList>

      <ActionArea>
        {!checked ? (
          <>
            <PrimaryAction label="確かめる" onClick={check} isDisabled={value === ''} />
            <AskAi question={question} />
          </>
        ) : (
          <>
            <Feedback
              correct={result}
              correctAnswer={answerLetter}
              explanation={question.explanation}
              note={result ? undefined : picked?.why}
              source={question.source}
              question={question}
            />
            <PrimaryAction label={nextLabel} onClick={onNext} />
            <LazyPart>
              <ReadMore question={question} domain={domain} />
            </LazyPart>
            <AskAi question={question} answered={{ picked: value, correct: result }} />
          </>
        )}
      </ActionArea>
    </VStack>
  );
}

/**
 * 誤答のあと、選択肢の上に正解と選んだ答えを示す札。色だけに頼らず、印 (○ / ×) と文字で分かるようにする
 * (選択肢は答えたあと押せなくなって薄く描かれるので、札は薄くしない色で描く。styles.css の .choice-mark)
 */
export function ChoiceMark({ isAnswer, isPicked }: { isAnswer: boolean; isPicked: boolean }) {
  if (isAnswer) return <span className="choice-mark choice-mark--answer"><span aria-hidden="true">○ </span>正解</span>;
  if (isPicked) return <span className="choice-mark choice-mark--picked"><span aria-hidden="true">× </span>選んだ答え</span>;
  return null;
}
