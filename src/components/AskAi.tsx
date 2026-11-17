import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { Question } from '../content/types';
import { aiLinks, questionText, type AnswerState } from '../lib/askAi';

/** 問題文を入力済みにした Claude / ChatGPT を新しいタブで開く */
export default function AskAi({ question, answered }: { question: Question; answered?: AnswerState }) {
  const links = aiLinks(questionText(question, answered));
  const icon = <ChatBubbleLeftRightIcon width={16} height={16} />;
  return (
    <HStack gap={2} wrap="wrap" vAlign="center">
      <Text type="supporting">{answered ? 'もっと詳しく聞く' : 'AI にヒントを聞く'}</Text>
      <Button size="sm" variant="ghost" icon={icon} label="Claude" href={links.claude} target="_blank" />
      <Button size="sm" variant="ghost" icon={icon} label="ChatGPT" href={links.chatgpt} target="_blank" />
    </HStack>
  );
}
