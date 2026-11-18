import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { WEEKS } from '../content/curriculum';
import { DOMAINS, domainAccuracy, planStatus, weeklyXp } from '../lib/lessonStatus';
import { currentStreak, dayKey, daysBetween, examDate, type Progress } from '../lib/progress';
import { examHref, reviewHref, weekHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function Body({ progress }: { progress: Progress }) {
  const now = new Date();
  const examDays = daysBetween(dayKey(now), examDate(progress));
  const plan = planStatus(progress, now);
  const accuracy = domainAccuracy(progress);
  const days = weeklyXp(progress, now);
  const maxXp = Math.max(1, ...days.map((d) => d.xp));
  const due = dueReviewCount(progress, now);
  const labsNote = plan.labsLeft > 0 ? ` (実習 ${plan.labsLeft} つ残り)` : '';
  const planText =
    plan.expected === 0 ? 'これから' : plan.done >= plan.expected ? `予定どおり${labsNote}` : `${plan.expected - plan.done} レッスン遅れ${labsNote}`;
  const dayName = (day: string, isToday: boolean) => {
    if (isToday) return '今日';
    const d = new Date(day + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
  };

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">進捗</h1>
      </VStack>

      <dl className="stats stats--card">
        <div className="stats__item">
          <dt>
            <Text type="supporting">{examDays >= 0 ? '試験まで' : '試験日'}</Text>
          </dt>
          <dd>{examDays > 0 ? `${examDays} 日` : examDays === 0 ? '今日' : '過ぎました'}</dd>
        </div>
        <div className="stats__item">
          <dt>
            <Text type="supporting">連続</Text>
          </dt>
          <dd>{currentStreak(progress, now)} 日</dd>
        </div>
        <div className="stats__item">
          <dt>
            <Text type="supporting">計画</Text>
          </dt>
          <dd className={plan.expected > 0 && plan.done < plan.expected ? 'text-warning' : undefined}>{planText}</dd>
        </div>
      </dl>

      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">分野ごとの正答率</h2>
          {DOMAINS.map((d) => {
            const rate = accuracy[d.name];
            return (
              <ProgressBar
                key={d.name}
                label={`${d.name} (配点 ${d.weight}%)`}
                value={rate === null ? 0 : Math.round(rate * 100)}
                hasValueLabel
                formatValueLabel={(v) => (rate === null ? '未着手' : `${v}%`)}
              />
            );
          })}
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <HStack justify="between" vAlign="center">
            <h2 className="h-sm">この 7 日の XP</h2>
            <Text type="supporting">計 {days.reduce((s, d) => s + d.xp, 0)} XP</Text>
          </HStack>
          <div className="xp-chart" role="img" aria-label={days.map((d, i) => `${dayName(d.day, i === days.length - 1)} ${d.xp} XP`).join('、')}>
            {days.map((d, i) => (
              <div key={d.day} className="xp-chart__col">
                <div className={`xp-chart__bar${i === days.length - 1 ? ' xp-chart__bar--today' : ''}`} style={{ height: `${(d.xp / maxXp) * 100}%` }} />
                <span className={`xp-chart__label${i === days.length - 1 ? ' xp-chart__label--today' : ''}`}>
                  {i === days.length - 1 ? '今日' : WEEKDAYS[new Date(d.day + 'T00:00:00').getDay()]}
                </span>
              </div>
            ))}
          </div>
        </VStack>
      </Card>

      <Card padding={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <VStack gap={0.5}>
            <h2 className="h-sm">今日の復習 {due} 問</h2>
            <Text type="supporting">間違えた問題を 1・3・7 日後に出します</Text>
          </VStack>
          <Button variant={due > 0 ? 'primary' : 'secondary'} label={due > 0 ? '始める' : '見る'} href={reviewHref} />
        </HStack>
      </Card>

      <Card padding={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <VStack gap={0.5}>
            <h2 className="h-sm">模擬試験</h2>
            <Text type="supporting">
              {progress.exams?.[0]
                ? `前回 ${progress.exams[0].correct} / ${progress.exams[0].total} 問 (${Math.round((progress.exams[0].correct / progress.exams[0].total) * 100)}%) · ${progress.exams.length} 回受けた`
                : 'まだ受けていません · 60 問・90 分'}
            </Text>
          </VStack>
          <Button label="模擬試験へ" href={examHref} />
        </HStack>
      </Card>

      <List hasDividers header={<h2 className="h-sm">週ごとの進み具合</h2>}>
        {WEEKS.map((w) => {
          const lessons = w.content?.lessons ?? [];
          const done = lessons.filter((l) => progress.lessons[l.id]?.done).length;
          return (
            <ListItem
              key={w.week}
              href={weekHref(w.week)}
              label={`第 ${w.week} 週 ${w.title}`}
              description={w.area}
              endContent={<Text type="supporting">{lessons.length > 0 ? `${done} / ${lessons.length}` : '準備中'}</Text>}
            />
          );
        })}
      </List>
    </VStack>
  );
}

export default function ProgressScreen({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="progress" progress={progress} />}>
        <div className="desk">
          <div className="about">
            <Body progress={progress} />
          </div>
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
      <main className="page__section">
        <Body progress={progress} />
      </main>
      <BottomTabs current="stats" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
