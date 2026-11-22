import { lazy, type ReactNode } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { LazyPart } from './LoadBoundary';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Question } from '../content/types';
import { findLesson } from '../content';
import { reportIssueUrl } from '../lib/links';

// コマンドの説明のデータは最初に読む JS に入れない (問題を開いたときに src/lib/preloadNotes.ts が先に読む)
const CommandNotes = lazy(() => import('./CommandNotes'));

/** 正解・不正解の知らせと解説。不正解のときは、選んだものがなぜ違うかを先に出す */
export default function Feedback({
  correct,
  correctAnswer,
  explanation,
  note,
  source,
  question,
  extra,
  notesOpen,
}: {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  note?: string;
  source: string;
  /** 渡すと、問題に出てくるコマンドの説明を解説の下に出す */
  question?: Question;
  /** 解説のすぐ下、コマンドの説明より前に出すもの (穴埋めの実行結果の例など。問題の続きなので先に出す) */
  extra?: ReactNode;
  /** コマンドの説明を開いて出すか (省くとコマンドの数で決める) */
  notesOpen?: boolean;
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
            {question && <ReportLink question={question} />}
          </VStack>
        }
      />
      {extra}
      {question && (
        <LazyPart>
          <CommandNotes question={question} open={notesOpen} />
        </LazyPart>
      )}
    </>
  );
}

/** 問題の誤りを GitHub の Issue で知らせるリンク (問題の id・レッスン・ページの URL を入れて開く) */
function ReportLink({ question }: { question: Question }) {
  const lessonId = question.id.match(/^(w\d+-[a-z0-9]+)-q\d+$/)?.[1];
  const found = lessonId ? findLesson(lessonId) : undefined;
  const lesson = found ? `第 ${found.week} 週 ${found.lesson.title} (${lessonId})` : undefined;
  return (
    <Text type="supporting">
      <Link href={reportIssueUrl(question, lesson, window.location.pathname)} isExternalLink newTabLabel="(新しいタブで開きます)">
        この問題の誤りを報告 (GitHub の Issue)
      </Link>
    </Text>
  );
}
