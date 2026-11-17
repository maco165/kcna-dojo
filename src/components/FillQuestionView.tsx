import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { FillQuestion } from '../content/types';
import { gradeFill, normalizeAnswer } from '../lib/grade';
import Feedback from './Feedback';

const LANGUAGE_LABEL: Record<FillQuestion['language'], string> = {
  bash: 'bash',
  yaml: 'yaml',
  dockerfile: 'Dockerfile',
};

export default function FillQuestionView({
  question,
  onChecked,
  nextLabel,
  onNext,
}: {
  question: FillQuestion;
  onChecked: (correct: boolean) => void;
  nextLabel: string;
  onNext: () => void;
}) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [before, after] = question.code.split('{{blank}}');
  const checked = result !== null;
  const typed = normalizeAnswer(value);
  const longest = Math.max(8, ...question.answers.map((a) => a.length), ...(question.candidates ?? []).map((c) => c.length));

  const check = () => {
    if (checked || typed === '') return;
    const ok = gradeFill(question, value);
    setResult(ok);
    onChecked(ok);
  };

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Text type="supporting">{LANGUAGE_LABEL[question.language]} の穴埋め</Text>
        <Heading level={2}>{question.prompt}</Heading>
      </VStack>

      <div className="fill-code" data-testid="fill-code">
        <div className="fill-code__header">
          <Text type="supporting">{LANGUAGE_LABEL[question.language]}</Text>
        </div>
        <div className="fill-code__body">
          {question.language === 'bash' && <span className="fill-code__prompt">$ </span>}
          {before}
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
          {after}
        </div>
      </div>

      {question.candidates && !checked && (
        <VStack gap={2}>
          <Text type="supporting">候補 (打っても、押しても入ります)</Text>
          <HStack gap={2} wrap="wrap">
            {question.candidates.map((c) => (
              <Button key={c} size="sm" label={c} onClick={() => setValue(c)} variant={typed === c ? 'primary' : 'secondary'} />
            ))}
          </HStack>
        </VStack>
      )}

      {!checked ? (
        <HStack justify="end">
          <Button variant="primary" label="確かめる" isDisabled={typed === ''} onClick={check} />
        </HStack>
      ) : (
        <VStack gap={4}>
          <Feedback
            correct={result}
            correctAnswer={question.answers[0]}
            explanation={question.explanation}
            note={result ? undefined : question.wrongNotes?.[typed]}
            source={question.source}
          />
          {result && question.output && (
            <CodeBlock code={question.output} title="実行結果の例" width="100%" size="sm" hasCopyButton={false} />
          )}
          <HStack justify="end">
            <Button variant="primary" label={nextLabel} onClick={onNext} />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}
