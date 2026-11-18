import { useState } from 'react';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { VStack } from '@astryxdesign/core/Stack';
import type { ChoiceQuestion } from '../content/types';
import { gradeChoice } from '../lib/grade';
import AskAi from './AskAi';
import Feedback from './Feedback';
import { ActionArea, PrimaryAction, QuestionHead } from './QuestionFrame';

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
          <RadioListItem key={c.id} value={c.id} label={`${String.fromCharCode(65 + i)}. ${c.text}`} />
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
            />
            <PrimaryAction label={nextLabel} onClick={onNext} />
            <AskAi question={question} answered={{ picked: value, correct: result }} />
          </>
        )}
      </ActionArea>
    </VStack>
  );
}
