import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { CARD_HEIGHT, CARD_WIDTH, cardAlt, cardFileName, drawCard, type CardData, type Ctx } from '../lib/summaryCard';

/** canvas に描いて PNG にする */
async function renderCard(d: CardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('この端末では画像を描けません');
  drawCard(ctx as unknown as Ctx, d);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像にできませんでした'))), 'image/png'));
}

/**
 * まとめのカード (進捗の画面で押したときに React.lazy で読む)。描いた画像を見せ、保存と共有 (navigator.share の files) を出す。
 * ファイルを共有できない端末では保存だけ
 */
export default function SummaryCard({ data }: { data: CardData }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    renderCard(data).then(
      (b) => {
        if (!alive) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : '画像にできませんでした'),
    );
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [data]);
  const file = blob ? new File([blob], cardFileName(data), { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });
  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch {
      // 閉じた・共有できなかったときは何もしない (保存は使える)
    }
  };
  if (error) return <Text type="supporting">{error}</Text>;
  if (!url) return <Text type="supporting">カードを描いています…</Text>;
  return (
    <VStack gap={3}>
      <img src={url} width={CARD_WIDTH} height={CARD_HEIGHT} alt={cardAlt(data)} className="summary-card__img" />
      <HStack gap={2} wrap="wrap">
        <Button variant="primary" label="画像を保存" href={url} {...{ download: cardFileName(data) }} />
        {canShareFile && <Button label="共有" onClick={share} />}
      </HStack>
      <Text type="supporting">名前・端末・受験日・問題や答えは入りません。保存した画像は、この端末の外には自動では送りません。</Text>
    </VStack>
  );
}
