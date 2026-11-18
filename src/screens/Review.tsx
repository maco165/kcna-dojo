import { useMemo, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { List, ListItem } from '@astryxdesign/core/List';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { allQuestions, dueQuestions, isKnownQuestion, type QuestionRef } from '../content';
import { DOMAINS } from '../lib/lessonStatus';
import { PRACTICE_SIZES, pickPractice, type PracticeDomain } from '../lib/practice';
import { XP_PER_CORRECT } from '../lib/grade';
import { completeReview, upcomingReview, type Progress } from '../lib/progress';
import { reviewHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import { QuestionRun } from './LessonScreen';

type Props = { progress: Progress; updateProgress: (fn: (p: Progress) => Progress) => void };

function formatDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${m}/${d}`;
}

/** 全週の問題から、分野と数を選んでランダムに出す */
type RandomChoice = { domain: PracticeDomain; size: string };

/** 分野と数は Review が持つ (解き終えて戻っても、同じ条件で続けられるように) */
function RandomCard({ choice, onChange, onStart }: { choice: RandomChoice; onChange: (c: RandomChoice) => void; onStart: () => void }) {
  const { domain, size } = choice;
  const setDomain = (d: PracticeDomain) => onChange({ ...choice, domain: d });
  const setSize = (n: string) => onChange({ ...choice, size: n });
  const all = allQuestions();
  const available = domain === 'all' ? all.length : all.filter((q) => q.domain === domain).length;
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <h2 className="h-sm">ランダム出題</h2>
        <Text type="supporting">第 1〜8 週の問題から、週の順に関係なく選んで出します。1 問ずつ答えと解説が出て、間違えた問題は復習に入ります。今日の復習の問題に当たったときは、ここでの答えがその日の復習として記録されます。</Text>
        <RadioList label="分野" value={domain} onChange={(v) => setDomain(v as PracticeDomain)}>
          <RadioListItem value="all" label={`すべての分野 (${all.length} 問)`} />
          {DOMAINS.map((d) => (
            <RadioListItem key={d.name} value={d.name} label={`${d.name} (${all.filter((q) => q.domain === d.name).length} 問)`} />
          ))}
        </RadioList>
        <SegmentedControl label="問題の数" value={size} onChange={setSize}>
          {PRACTICE_SIZES.map((n) => (
            <SegmentedControlItem key={n} value={String(n)} label={`${n} 問`} />
          ))}
        </SegmentedControl>
        <HStack>
          <Button variant="primary" label={`${Math.min(Number(size), available)} 問を始める`} onClick={onStart} />
        </HStack>
      </VStack>
    </Card>
  );
}

function Overview({ progress, onStart, random }: { progress: Progress; onStart: () => void; random: { choice: RandomChoice; onChange: (c: RandomChoice) => void; onStart: () => void } }) {
  const now = new Date();
  const due = dueQuestions(progress, now);
  const upcoming = upcomingReview(progress, now, isKnownQuestion);
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">復習</h1>
        <Text type="supporting">間違えた問題を 1 日後に出し、正解するたびに 3 日後・7 日後と間を空けます。3 回続けて正解したら終わりです。</Text>
      </VStack>

      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">今日の復習 {due.length} 問</h2>
          {due.length > 0 ? (
            <>
              <Text type="supporting">1 問正解で {XP_PER_CORRECT} XP。終えると連続日数も進みます。</Text>
              <div>
                <Button variant="primary" label="復習を始める" onClick={onStart} />
              </div>
            </>
          ) : (
            <Text type="supporting">
              {upcoming ? `今日の復習はありません。次は ${formatDay(upcoming.day)} に ${upcoming.count} 問です。` : '復習する問題はまだありません。レッスンで間違えた問題がここに来ます。'}
            </Text>
          )}
        </VStack>
      </Card>

      <RandomCard {...random} />

      {due.length > 0 && (
        <List hasDividers edge="flush" header={<h2 className="h-sm">今日の問題</h2>}>
          {due.map((r) => (
            <ListItem key={r.question.id} label={r.question.prompt} description={`第 ${r.week} 週 · ${r.lesson.title}`} />
          ))}
        </List>
      )}
    </VStack>
  );
}

export default function Review({ progress, updateProgress }: Props) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const [running, setRunning] = useState<QuestionRef[] | null>(null);
  const [mode, setMode] = useState<'review' | 'random'>('review');
  const [choice, setChoice] = useState<RandomChoice>({ domain: 'all', size: String(PRACTICE_SIZES[0]) });
  const questions = useMemo(() => running?.map((r) => r.question) ?? [], [running]);

  if (running && running.length > 0) {
    const domains = new Map(running.map((r) => [r.question.id, r.lesson.domain]));
    return (
      <QuestionRun
        title={mode === 'random' ? 'ランダム出題' : '今日の復習'}
        resultLabel={mode === 'random' ? 'ランダム出題' : '今日の復習'}
        questions={questions}
        domainOf={(q) => domains.get(q.id) ?? ''}
        closeHref={reviewHref}
        onClose={() => setRunning(null)}
        backHref={reviewHref}
        onBack={() => setRunning(null)}
        progress={progress}
        updateProgress={updateProgress}
        // 復習では解いた問題が今日の一覧から外れるので、XP は正解のたびに入れる (途中で閉じても残る)
        onCorrect={(p) => completeReview(p, XP_PER_CORRECT, new Date())}
        onFinish={(p) => completeReview(p, 0, new Date())}
      />
    );
  }

  const body = (
    <Overview
      progress={progress}
      onStart={() => {
        setMode('review');
        setRunning(dueQuestions(progress, new Date()));
      }}
      random={{
        choice,
        onChange: setChoice,
        onStart: () => {
          setMode('random');
          setRunning(pickPractice(allQuestions(), Number(choice.size), choice.domain));
        },
      }}
    />
  );
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="review" progress={progress} />}>
        <div className="desk">
          <div className="about">{body}</div>
        </div>
      </AppShell>
    );
  }
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar__brand">
          <SiteLogo />
          <Text type="large">{SITE_NAME}</Text>
        </span>
        <RepoLink />
      </header>
      <main className="page__section">{body}</main>
      <BottomTabs current="review" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}
