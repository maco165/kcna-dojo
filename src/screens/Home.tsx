import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import StatusIcon from '../components/StatusIcon';
import { WEEKS, type WeekMeta } from '../content/curriculum';
import type { Lesson } from '../content/types';
import {
  DOMAINS,
  domainAccuracy,
  lessonCaption,
  lessonCorrect,
  lessonCount,
  lessonFormat,
  lessonStatuses,
  type LessonStatus,
} from '../lib/lessonStatus';
import { downloadProgress } from '../lib/download';
import { SITE_NAME } from '../lib/site';
import { currentStreak, dayKey, daysBetween, dueReviewIds, examDate, goalXp, todayXp, type Progress } from '../lib/progress';
import { aboutHref, lessonHref, reviewHref, weekHref } from '../lib/route';
import { dueQuestions } from './Review';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

function formatDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${m}/${d}`;
}

function weekEnd(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + 6));
}

function doneCount(w: WeekMeta, progress: Progress): number {
  return (w.content?.lessons ?? []).filter((l) => progress.lessons[l.id]?.done).length;
}

type Summary = {
  meta: WeekMeta;
  lessons: Lesson[];
  statuses: LessonStatus[];
  today: number;
  streak: number;
  examDays: number;
  goal: number;
};

function summarize(week: number, progress: Progress): Summary {
  const now = new Date();
  const meta = WEEKS.find((w) => w.week === week) ?? WEEKS[0];
  const lessons = meta.content?.lessons ?? [];
  return {
    meta,
    lessons,
    statuses: lessonStatuses(lessons, progress),
    today: todayXp(progress, now),
    streak: currentStreak(progress, now),
    examDays: daysBetween(dayKey(now), examDate(progress)),
    goal: goalXp(progress),
  };
}

const goalLabel = (today: number, goal: number) => `${today} / ${goal} XP`;

/** 試験までの日数の表示。受験日を過ぎたら日数を出さない */
const examLabel = (days: number) => (days > 0 ? `試験まで ${days} 日` : days === 0 ? '今日が試験日' : '試験日を過ぎました');

export default function Home({ week, progress }: { week: number; progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const s = summarize(week, progress);
  return isWide ? <DesktopHome s={s} progress={progress} /> : <PhoneHome s={s} progress={progress} />;
}

function scrollToGoals(e: React.MouseEvent) {
  e.preventDefault();
  document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' });
}

function Goals({ meta }: { meta: WeekMeta }) {
  return (
    <List listStyle="decimal" header={<h2 className="h-sm" id="goals">この週で説明できるようにすること</h2>}>
      {meta.goals.map((g) => (
        <ListItem key={g} label={g} />
      ))}
    </List>
  );
}

/* ---------- スマホ ---------- */

function PhoneHome({ s, progress }: { s: Summary; progress: Progress }) {
  const { meta, lessons, statuses } = s;
  const nextWeek = WEEKS.find((w) => w.week === meta.week + 1);
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar__brand">
          <SiteLogo />
          <Text type="large">{SITE_NAME}</Text>
        </span>
        <span className="topbar__end">
          <Text type="supporting">
            {s.streak} 日連続 · {progress.xp.total} XP · {examLabel(s.examDays)}
          </Text>
          <RepoLink />
        </span>
      </header>

      <section className="band">
        <ProgressBar
          label="今日の目標"
          value={Math.min(s.today, s.goal)}
          max={s.goal}
          hasValueLabel
          formatValueLabel={() => goalLabel(s.today, s.goal)}
        />
      </section>

      <main className="page__main">
        <div className="week-head">
          <VStack gap={0.5}>
            <Text type="supporting">
              第 {meta.week} 週 · {meta.area} · {doneCount(meta, progress)}/{lessons.length} 完了
            </Text>
            <h1 className="week-title">{meta.title}</h1>
          </VStack>
          <Link href={weekHref(meta.week)} onClick={scrollToGoals}>
            要点を読む
          </Link>
        </div>

        <div className="rows">
          {lessons.length > 0 ? (
            <List hasDividers>
              {lessons.map((l, i) => (
                <LessonRow key={l.id} lesson={l} status={statuses[i]} />
              ))}
            </List>
          ) : (
            <div className="rows__empty">
              <Text type="supporting">この週の問題は準備中です。</Text>
            </div>
          )}
        </div>

        {nextWeek && (
          <div className="rows rows--spaced">
            <List>
              <ListItem
                href={weekHref(nextWeek.week)}
                label={`第 ${nextWeek.week} 週 ${nextWeek.title}`}
                description={`${nextWeek.area} · ${formatDate(nextWeek.start)}〜`}
                endContent={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                }
              />
            </List>
          </div>
        )}

        <div className="page__section">
          <Goals meta={meta} />
        </div>

        <div className="rows">
          <List>
            <ListItem
              href={aboutHref}
              label="このサイトについて"
              description="GitHub のリポジトリ · 誤りの知らせ方 · 記録の置き場所"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
          </List>
        </div>
      </main>

      <BottomTabs current="learn" reviewCount={dueReviewIds(progress, new Date()).length} />
    </div>
  );
}

function LessonRow({ lesson, status }: { lesson: Lesson; status: LessonStatus }) {
  const caption = <span className="caption-code">{lessonCaption(lesson)}</span>;
  if (status === 'next') {
    return (
      <ListItem
        label={<Text weight="semibold">{lesson.title}</Text>}
        description={caption}
        startContent={<StatusIcon status={status} />}
        endContent={<Button variant="primary" label="開始" href={lessonHref(lesson.id)} />}
      />
    );
  }
  return (
    <ListItem
      href={lessonHref(lesson.id)}
      label={lesson.title}
      description={caption}
      startContent={<StatusIcon status={status} isLab={lesson.kind === 'lab'} isDecorative />}
      endContent={
        status === 'done' ? (
          <Text type="supporting" color="inherit">
            <span className="text-success">完了</span>
          </Text>
        ) : (
          <Text type="supporting">未着手</Text>
        )
      }
    />
  );
}

/* ---------- PC ---------- */

type Row = Record<string, unknown> & { lesson: Lesson; status: LessonStatus };

function DesktopHome({ s, progress }: { s: Summary; progress: Progress }) {
  const { meta, lessons, statuses } = s;
  const accuracy = domainAccuracy(progress);
  const due = dueQuestions(progress, new Date());
  const rows: Row[] = lessons.map((l, i) => ({ id: l.id, lesson: l, status: statuses[i] }));

  const columns: TableColumn<Row>[] = [
    {
      key: 'lesson',
      header: 'レッスン',
      width: proportional(2),
      renderCell: (r) => (
        <VStack gap={0}>
          {r.status === 'next' ? (
            <Text weight="semibold">{r.lesson.title}</Text>
          ) : (
            <Link href={lessonHref(r.lesson.id)} color="primary" weight="medium">
              {r.lesson.title}
            </Link>
          )}
          <span className="caption-code">{r.lesson.id.replace(/^w\d+-/, '')}</span>
        </VStack>
      ),
    },
    {
      key: 'format',
      header: '問題の形',
      width: proportional(2),
      renderCell: (r) => (
        <Text type="supporting">
          {lessonFormat(r.lesson)} · {lessonCount(r.lesson)} {r.lesson.kind === 'lab' ? '手順' : '問'}
        </Text>
      ),
    },
    { key: 'correct', header: '最高の正答', width: pixel(100), renderCell: (r) => <Text>{lessonCorrect(r.lesson, progress)}</Text> },
    {
      key: 'status',
      header: '状態',
      width: pixel(100),
      renderCell: (r) => (
        <HStack gap={1.5} vAlign="center">
          <StatusDot
            variant={r.status === 'done' ? 'success' : r.status === 'next' ? 'accent' : 'neutral'}
            label={r.status === 'done' ? '完了' : r.status === 'next' ? '次' : '未着手'}
          />
          <Text>{r.status === 'done' ? '完了' : r.status === 'next' ? '次' : '未着手'}</Text>
        </HStack>
      ),
    },
    {
      key: 'action',
      header: '',
      width: pixel(96),
      align: 'end',
      renderCell: (r) =>
        r.status === 'next' ? (
          <Button variant="primary" size="sm" label="開始" href={lessonHref(r.lesson.id)} />
        ) : r.status === 'done' ? (
          <Link href={lessonHref(r.lesson.id)}>見直す</Link>
        ) : (
          <Link href={lessonHref(r.lesson.id)}>開く</Link>
        ),
    },
  ];

  const sideNav = <AppSideNav current="learn" week={meta.week} progress={progress} />;

  return (
    <AppShell contentPadding={0} variant="section" sideNav={sideNav}>
      <div className="desk">
        <header className="desk__head">
          <VStack gap={0.5}>
            <Text type="supporting">
              第 {meta.week} 週 · {meta.domain} · {meta.area} · {formatDate(meta.start)}〜{formatDate(weekEnd(meta.start))}
            </Text>
            <Heading level={1}>{meta.title}</Heading>
          </VStack>
          <HStack gap={6} wrap="wrap">
            <Text type="supporting">
              今日 <Text weight="semibold">{goalLabel(s.today, s.goal)}</Text>
            </Text>
            <Text type="supporting">
              連続 <Text weight="semibold">{s.streak} 日</Text>
            </Text>
            <Text type="supporting">
              {s.examDays > 0 ? (
                <>
                  試験まで <Text weight="semibold">{s.examDays} 日</Text>
                </>
              ) : (
                <Text weight="semibold">{examLabel(s.examDays)}</Text>
              )}
            </Text>
          </HStack>
        </header>

        <div className="desk__body">
          <main className="desk__main">
            <Card padding={0}>
              {rows.length > 0 ? (
                <Table data={rows} columns={columns} idKey="id" />
              ) : (
                <div className="rows__empty">
                  <Text type="supporting">この週の問題は準備中です。</Text>
                </div>
              )}
            </Card>
            <Goals meta={meta} />
          </main>

          <aside className="desk__aside">
            <Card padding={4}>
              <VStack gap={3}>
                <h2 className="h-sm">分野ごとの正答率</h2>
                {DOMAINS.map((d) => {
                  const rate = accuracy[d.name];
                  return (
                    <ProgressBar
                      key={d.name}
                      label={`${d.short} (配点 ${d.weight}%)`}
                      value={rate === null ? 0 : Math.round(rate * 100)}
                      hasValueLabel
                      formatValueLabel={(v) => (rate === null ? '未着手' : `${v}%`)}
                    />
                  );
                })}
              </VStack>
            </Card>
            <Card padding={4}>
              <VStack gap={2}>
                <HStack justify="between" vAlign="center">
                  <h2 className="h-sm">今日の復習 {due.length} 問</h2>
                  <Button size="sm" variant={due.length > 0 ? 'primary' : 'secondary'} label={due.length > 0 ? '始める' : '見る'} href={reviewHref} />
                </HStack>
                <Text type="supporting">
                  {due.length > 0
                    ? due
                        .slice(0, 3)
                        .map((r) => r.lesson.title)
                        .filter((t, i, a) => a.indexOf(t) === i)
                        .join(' / ')
                    : '間違えた問題を 1・3・7 日後に出します'}
                </Text>
              </VStack>
            </Card>
            <VStack gap={1}>
              <Text type="supporting">記録はこのブラウザ (localStorage) にだけ保存されます。</Text>
              <div>
                <Button size="sm" variant="ghost" label="記録を書き出す (JSON)" onClick={() => downloadProgress(progress, new Date())} />
              </div>
            </VStack>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
