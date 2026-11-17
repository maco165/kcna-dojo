import { Banner } from '@astryxdesign/core/Banner';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { XP_PER_CORRECT } from '../lib/grade';

/** 正解・不正解の知らせと解説。不正解のときは、選んだものがなぜ違うかを先に出す */
export default function Feedback({
  correct,
  correctAnswer,
  explanation,
  note,
  source,
}: {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  note?: string;
  source: string;
}) {
  return (
    <Banner
      status={correct ? 'success' : 'error'}
      title={correct ? `正解 +${XP_PER_CORRECT} XP` : `不正解 · 正しくは ${correctAnswer}`}
      collapsible={false}
      description={
        <VStack gap={2}>
          {note && <Text>{note}</Text>}
          <Text>{explanation}</Text>
          <Text type="supporting">
            出典:{' '}
            <Link href={source} isExternalLink newTabLabel="(新しいタブで開きます)">
              {new URL(source).hostname}
            </Link>
          </Text>
        </VStack>
      }
    />
  );
}
