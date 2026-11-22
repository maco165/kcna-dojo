import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { MASTERY_LABEL, MASTERY_ORDER, pctOf, type DomainMastery } from '../lib/mastery';

/** 問題ごとの到達を分野ごとに、積み上げの帯と数・割合の文で出す (帯は飾りで、数は文で読む) */
export default function MasteryCard({ rows }: { rows: DomainMastery[] }) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <h2 className="h-sm">問題ごとの到達</h2>
          <Text type="supporting">レッスンと模擬試験の問題を、いちばん新しい答えまでで 4 つに分けます。</Text>
        </VStack>
        <ul className="mastery">
          {rows.map((r) => (
            <li key={r.domain} className="mastery__row">
              <Text weight="medium">{`${r.domain} (${r.total} 問)`}</Text>
              <span className="mastery__bar" aria-hidden="true">
                {MASTERY_ORDER.map((m) => (r.counts[m] > 0 ? <span key={m} className={`mastery__seg mastery__seg--${m}`} style={{ flexGrow: r.counts[m] }} /> : null))}
              </span>
              <Text type="supporting">{MASTERY_ORDER.map((m) => `${MASTERY_LABEL[m]} ${r.counts[m]} (${pctOf(r.counts[m], r.total)}%)`).join(' · ')}</Text>
            </li>
          ))}
        </ul>
        <Text type="supporting">帯は左から 2 回続けて正解 (濃い) · 1 回正解 · 間違えた (斜線) · まだ (地の色)。</Text>
      </VStack>
    </Card>
  );
}
