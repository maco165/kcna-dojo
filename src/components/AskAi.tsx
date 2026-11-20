import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ChatBubbleLeftRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import type { Question } from '../content/types';
import { aiLinks, questionText, type AnswerState } from '../lib/askAi';
import { copyText } from '../lib/copyText';

/**
 * 文を入力済みにした Claude / ChatGPT を新しいタブで開く (サイトからは何も送らない)。
 * ほかの AI (Gemini など) に貼るときのために、同じ文をコピーするボタンも置く
 */
export function AskAiLinks({ text, lead }: { text: string; lead: string }) {
  const links = aiLinks(text);
  const icon = <ChatBubbleLeftRightIcon width={16} height={16} />;
  // copied: コピーできた / failed: コピーできなかったので文を見せる
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => setState((await copyText(text)) ? 'copied' : 'failed');
  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Text type="supporting">{lead}</Text>
        <Button size="sm" variant="ghost" icon={icon} label="Claude" href={links.claude} target="_blank" rel="noopener noreferrer" />
        <Button size="sm" variant="ghost" icon={icon} label="ChatGPT" href={links.chatgpt} target="_blank" rel="noopener noreferrer" />
        <Button size="sm" variant="ghost" icon={<ClipboardDocumentIcon width={16} height={16} />} label="文をコピー (ほかの AI に貼る)" onClick={() => void copy()} />
        {/* 読み上げにもコピーの結果を伝える */}
        <span className="ask-ai__status" role="status">
          {state === 'copied' ? 'コピーしました' : state === 'failed' ? 'コピーできませんでした。下の文を選んでコピーしてください' : ''}
        </span>
      </HStack>
      {state === 'failed' && <textarea className="ask-ai__text" readOnly value={text} aria-label="AI に貼る文" rows={6} onFocus={(e) => e.currentTarget.select()} />}
    </VStack>
  );
}

/** 問題文を入力済みにした Claude / ChatGPT を開く。同じ文をコピーもできる */
export default function AskAi({ question, answered }: { question: Question; answered?: AnswerState }) {
  return <AskAiLinks text={questionText(question, answered)} lead={answered ? 'もっと詳しく聞く' : 'AI にヒントを聞く'} />;
}
