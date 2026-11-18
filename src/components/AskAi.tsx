import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { Question } from '../content/types';
import { aiLinks, questionText, type AnswerState } from '../lib/askAi';

/** 文を入力済みにした Claude / ChatGPT を新しいタブで開く (サイトからは何も送らない) */
export function AskAiLinks({ text, lead }: { text: string; lead: string }) {
  const links = aiLinks(text);
  const icon = <ChatBubbleLeftRightIcon width={16} height={16} />;
  return (
    <HStack gap={2} wrap="wrap" vAlign="center">
      <Text type="supporting">{lead}</Text>
      <Button size="sm" variant="ghost" icon={icon} label="Claude" href={links.claude} target="_blank" rel="noopener noreferrer" />
      <Button size="sm" variant="ghost" icon={icon} label="ChatGPT" href={links.chatgpt} target="_blank" rel="noopener noreferrer" />
    </HStack>
  );
}

/** 問題文を入力済みにした Claude / ChatGPT を開く */
export default function AskAi({ question, answered }: { question: Question; answered?: AnswerState }) {
  return <AskAiLinks text={questionText(question, answered)} lead={answered ? 'もっと詳しく聞く' : 'AI にヒントを聞く'} />;
}
