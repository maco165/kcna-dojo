import { lazy, Suspense } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Question } from '../content/types';

// コマンドの説明のデータは、答えたあとに読む (最初に読む JS に入れない)
const CommandNotes = lazy(() => import('./CommandNotes'));

/** 正解・不正解の知らせと解説。不正解のときは、選んだものがなぜ違うかを先に出す */
export default function Feedback({
  correct,
  correctAnswer,
  explanation,
  note,
  source,
  question,
}: {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  note?: string;
  source: string;
  /** 渡すと、問題に出てくるコマンドの説明を解説の下に出す */
  question?: Question;
}) {
  return (
    <>
      <Banner
        status={correct ? 'success' : 'error'}
        title={correct ? '正解' : `不正解 · 正しくは ${correctAnswer}`}
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
      {question && (
        <Suspense fallback={null}>
          <CommandNotes question={question} />
        </Suspense>
      )}
    </>
  );
}
