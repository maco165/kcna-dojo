import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

/** 問題の見出し (種類 · 分野 · この問題を解いた記録) と問題文 */
export function QuestionHead({ kind, domain, prompt, history }: { kind: string; domain: string; prompt: string; history?: string }) {
  return (
    <VStack gap={1.5}>
      <Text type="supporting">
        {kind} · {domain}
        {history && ` · ${history}`}
      </Text>
      <h1 className="q-title">{prompt}</h1>
    </VStack>
  );
}

/** 確かめる・次へのボタン。スマホは全幅、PC は右寄せでキーの案内を添える */
export function PrimaryAction({
  label,
  onClick,
  isDisabled,
  kbdHint,
}: {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  kbdHint?: string;
}) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (!isWide) {
    return <Button variant="primary" size="lg" width="100%" label={label} onClick={onClick} isDisabled={isDisabled} />;
  }
  return (
    <HStack gap={3} justify={kbdHint ? 'between' : 'end'} vAlign="center" wrap="wrap">
      {kbdHint && <Text type="supporting">{kbdHint}</Text>}
      <Button variant="primary" label={label} onClick={onClick} isDisabled={isDisabled} />
    </HStack>
  );
}

/** 問題の下の操作の帯。スマホでは上に線を引いて区切る */
export function ActionArea({ children }: { children: ReactNode }) {
  return (
    <div className="q-actions">
      <VStack gap={3}>{children}</VStack>
    </div>
  );
}
