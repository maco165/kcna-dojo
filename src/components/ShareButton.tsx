import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { copyText } from '../lib/copyText';
import { shareNative, xPostUrl, type ShareData } from '../lib/share';

/** 「共有」。Web Share API があれば端末の共有を開き、無ければ X の投稿とリンクのコピーを出す */
export default function ShareButton({ data, size }: { data: ShareData; size?: 'md' | 'lg' }) {
  const [fallback, setFallback] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <VStack gap={2}>
      <div>
        <Button label="共有" size={size} onClick={async () => setFallback(!(await shareNative(data)))} />
      </div>
      {fallback && (
        <VStack gap={1.5}>
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Button label="X に投稿" href={xPostUrl(data)} target="_blank" rel="noopener noreferrer" />
            <Button label="リンクをコピー" onClick={async () => setCopied(await copyText(data.url))} />
          </HStack>
          <Text type="supporting" role="status">
            {copied === true ? 'リンクをコピーしました。' : copied === false ? `コピーできませんでした。${data.url}` : `共有する文: ${data.text} ${data.url}`}
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
