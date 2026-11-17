import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Heading } from '@astryxdesign/core/Heading';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ChoiceQuestion } from '../content/types';
import { gradeChoice } from '../lib/grade';
import AskAi from './AskAi';
import Feedback from './Feedback';

export default function ChoiceQuestionView({
  question,
  onChecked,
  nextLabel,
  onNext,
}: {
  question: ChoiceQuestion;
  onChecked: (correct: boolean) => void;
  nextLabel: string;
  onNext: () => void;
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
      <VStack gap={1}>
        <Text type="supporting">{question.code ? '出力を読む' : '4 択'}</Text>
        <Heading level={2}>{question.prompt}</Heading>
      </VStack>

      {question.code && (
        <CodeBlock code={question.code.text} language={question.code.language} width="100%" size="sm" hasCopyButton={false} />
      )}

      <RadioList label="選択肢" isLabelHidden value={value} onChange={setValue} isDisabled={checked}>
        {question.choices.map((c, i) => (
          <RadioListItem key={c.id} value={c.id} label={`${String.fromCharCode(65 + i)}. ${c.text}`} />
        ))}
      </RadioList>

      {!checked ? (
        <HStack gap={3} justify="between" wrap="wrap" vAlign="center">
          <AskAi question={question} />
          <Button variant="primary" label="確かめる" isDisabled={value === ''} onClick={check} />
        </HStack>
      ) : (
        <VStack gap={4}>
          <Feedback
            correct={result}
            correctAnswer={answerLetter}
            explanation={question.explanation}
            note={result ? undefined : picked?.why}
            source={question.source}
          />
          <HStack gap={3} justify="between" wrap="wrap" vAlign="center">
            <AskAi question={question} answered={{ picked: value, correct: result }} />
            <Button variant="primary" label={nextLabel} onClick={onNext} />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}
