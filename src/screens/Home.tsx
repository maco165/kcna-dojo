import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { DAILY_GOAL_XP, EXAM_DATE, WEEKS, type WeekMeta } from '../content/curriculum';
import type { Lesson } from '../content/types';
import { currentStreak, dayKey, daysBetween, todayXp, type Progress } from '../lib/progress';
import { lessonHref, weekHref } from '../lib/route';

type Status = 'done' | 'next' | 'pending';

function lessonStatuses(lessons: Lesson[], progress: Progress): Status[] {
  let nextGiven = false;
  return lessons.map((l) => {
    if (progress.lessons[l.id]?.done) return 'done';
    if (!nextGiven) {
      nextGiven = true;
      return 'next';
    }
    return 'pending';
  });
}

function doneCount(w: WeekMeta, progress: Progress): number {
  return (w.content?.lessons ?? []).filter((l) => progress.lessons[l.id]?.done).length;
}

function formatRange(start: string): string {
  const [, m, d] = start.split('-').map(Number);
  return `${m}/${d}〜`;
}

export default function Home({ week, progress }: { week: number; progress: Progress }) {
  const now = new Date();
  const meta = WEEKS.find((w) => w.week === week) ?? WEEKS[0];
  const lessons = meta.content?.lessons ?? [];
  const statuses = lessonStatuses(lessons, progress);
  const today = todayXp(progress, now);
  const examDays = daysBetween(dayKey(now), EXAM_DATE);

  const sideNav = (
    <SideNav header={<SideNavHeading heading="kcna-dojo" headingHref={weekHref(1)} />}>
      <SideNavSection title="週">
        {WEEKS.map((w) => {
          const total = w.content?.lessons.length ?? 0;
          return (
            <SideNavItem
              key={w.week}
              label={`${w.week} ${w.title}`}
              href={weekHref(w.week)}
              isSelected={w.week === meta.week}
              endContent={
                <Text type="supporting">{total > 0 ? `${doneCount(w, progress)}/${total}` : '準備中'}</Text>
              }
            />
          );
        })}
      </SideNavSection>
    </SideNav>
  );

  return (
    <AppShell contentPadding={0} sideNav={sideNav}>
      <Layout
        height="fill"
        contentWidth={880}
        content={
          <LayoutContent padding={4}>
            <VStack gap={6}>
              <HStack gap={4} wrap="wrap" justify="between" vAlign="end">
                <VStack gap={1}>
                  <Text type="supporting">
                    第 {meta.week} 週 · {meta.domain} · {meta.area} · {formatRange(meta.start)}
                  </Text>
                  <Heading level={1}>{meta.title}</Heading>
                </VStack>
                <HStack gap={4} wrap="wrap">
                  <Text type="supporting">
                    連続 <Text weight="semibold">{currentStreak(progress, now)} 日</Text>
                  </Text>
                  <Text type="supporting">
                    合計 <Text weight="semibold">{progress.xp.total} XP</Text>
                  </Text>
                  <Text type="supporting">
                    試験まで <Text weight="semibold">{examDays} 日</Text>
                  </Text>
                </HStack>
              </HStack>

              <ProgressBar
                label="今日の目標"
                value={Math.min(today, DAILY_GOAL_XP)}
                max={DAILY_GOAL_XP}
                hasValueLabel
                formatValueLabel={() => `${today} / ${DAILY_GOAL_XP} XP`}
              />

              {lessons.length > 0 ? (
                <List hasDividers edge="outset" header={<Heading level={2}>レッスン</Heading>}>
                  {lessons.map((l, i) => {
                    const status = statuses[i];
                    const record = progress.lessons[l.id];
                    return (
                      <ListItem
                        key={l.id}
                        href={status === 'next' ? undefined : lessonHref(l.id)}
                        label={l.title}
                        description={l.summary}
                        startContent={
                          status === 'done' ? (
                            <StatusDot variant="success" label="完了" />
                          ) : status === 'next' ? (
                            <StatusDot variant="accent" label="次" />
                          ) : (
                            <StatusDot variant="neutral" label="未着手" />
                          )
                        }
                        endContent={
                          status === 'next' ? (
                            <Button variant="primary" size="sm" label="開始" href={lessonHref(l.id)} />
                          ) : status === 'done' ? (
                            <Text type="supporting">完了 · 最高 {Math.round((record?.best ?? 0) * 100)}%</Text>
                          ) : (
                            <Text type="supporting">未着手</Text>
                          )
                        }
                      />
                    );
                  })}
                </List>
              ) : (
                <Text type="supporting">この週の問題は準備中です。</Text>
              )}

              <List listStyle="decimal" header={<Heading level={2}>この週で説明できるようにすること</Heading>}>
                {meta.goals.map((g) => (
                  <ListItem key={g} label={g} />
                ))}
              </List>

              <Text type="supporting">記録はこのブラウザ (localStorage) にだけ保存されます。</Text>
            </VStack>
          </LayoutContent>
        }
      />
    </AppShell>
  );
}
