import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import Crumbs from '../components/Crumbs';
import { Card } from '@astryxdesign/core/Card';
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
import type { LessonMeta as Lesson } from '../content/types';
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
import { SITE_NAME, SITE_TAGLINE } from '../lib/site';
import { addDays, currentStreak, daysToExam, goalXp, planStart, todayXp, weekStartDay, type Progress } from '../lib/progress';
import { aboutHref, compareHref, examHref, glossaryHref, guideHref, handbookHref, lessonHref, reviewHref, settingsHref, weekHref } from '../lib/route';
import { dueQuestions, dueReviewCount } from '../content';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

function formatDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${m}/${d}`;
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
  /** 試験までの日数。受験日を決めていなければ null */
  examDays: number | null;
  goal: number;
  /** 週の日付を数える起点 (利用者の開始日) */
  start: string;
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
    examDays: daysToExam(progress, now),
    goal: goalXp(progress),
    start: planStart(progress, now),
  };
}

const goalLabel = (today: number, goal: number) => `${today} / ${goal} XP`;

/** 試験までの日数の表示。受験日を過ぎたら日数を出さない */
const examLabel = (days: number) => (days > 0 ? `試験まで ${days} 日` : days === 0 ? '今日が試験日' : '試験日を過ぎました');

/** 試験までの日数。受験日を決めていなければ、決める画面 (設定) へのリンクを出す */
function ExamDays({ days }: { days: number | null }) {
  if (days === null) return <a href={settingsHref}>受験日を決める</a>;
  return <>{examLabel(days)}</>;
}

/** 週の日付 (利用者の開始日から数える): "11/30〜12/6" */
const weekRange = (start: string, week: number) => {
  const from = weekStartDay(start, week);
  return `${formatDate(from)}〜${formatDate(addDays(from, 6))}`;
};

export default function Home({ week, progress }: { week: number; progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const s = summarize(week, progress);
  return isWide ? <DesktopHome s={s} progress={progress} /> : <PhoneHome s={s} progress={progress} />;
}

/**
 * ホームの見出し。h1 は書き出す HTML の h1 とそろえる: トップ (第 1 週) はサイト名「クラネイ — KCNA-JP 対策」で週の名前は h2、
 * 第 2 週からは「第 n 週 週の名前」(week/<n>/ の書き出しと同じ)
 */
function WeekHeading({ meta, desk }: { meta: WeekMeta; desk?: boolean }) {
  if (meta.week === 1) return <h2 className={desk ? 'week-title week-title--desk' : 'week-title'}>{meta.title}</h2>;
  return <h1 className={desk ? 'week-title week-title--desk' : 'week-title'}>{`第 ${meta.week} 週 ${meta.title}`}</h1>;
}

/** トップだけの h1 (サイト名と副題。書き出す index.html の h1 と同じ) */
function SiteHeading({ meta }: { meta: WeekMeta }) {
  return meta.week === 1 ? <h1 className="home-site-title">{`${SITE_NAME} — ${SITE_TAGLINE}`}</h1> : null;
}

function scrollToGoals(e: React.MouseEvent) {
  e.preventDefault();
  document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' });
}

function Goals({ meta }: { meta: WeekMeta }) {
  return (
    <List listStyle="decimal" edge="flush" header={<h2 className="h-sm" id="goals">この週で説明できるようにすること</h2>}>
      {meta.goals.map((g) => (
        <ListItem key={g} label={g} />
      ))}
    </List>
  );
}

/** 先に読むハンドブックのトピック。読まなくてもレッスンは開ける (鍵は掛けない) */
function PreRead({ meta }: { meta: WeekMeta }) {
  return (
    <nav className="pre-read" aria-label="先に読むハンドブック">
      <span className="pre-read__label">先に読む</span>
      {meta.read.map((r) => (
        <a key={r.topic} className="gloss-chip" href={handbookHref(r.topic)}>
          {r.label}
        </a>
      ))}
    </nav>
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
            {s.streak} 日連続 · {progress.xp.total} XP · <ExamDays days={s.examDays} />
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
            {meta.week !== 1 && <Crumbs items={[{ name: `第 ${meta.week} 週 ${meta.title}` }]} />}
            <SiteHeading meta={meta} />
            <Text type="supporting">
              第 {meta.week} 週 · {meta.area} · {doneCount(meta, progress)}/{lessons.length} 完了
            </Text>
            <WeekHeading meta={meta} />
          </VStack>
          <Link href={weekHref(meta.week)} onClick={scrollToGoals}>
            要点を読む
          </Link>
        </div>

        <PreRead meta={meta} />

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
                description={`${nextWeek.area} · ${formatDate(weekStartDay(s.start, nextWeek.week))}〜`}
                endContent={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                }
              />
            </List>
          </div>
        )}

        <div className="rows rows--spaced">
          <List>
            <ListItem
              href={examHref}
              label="模擬試験"
              description="60 問・90 分 · 本番と同じ 4 分野の配点"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
            <ListItem
              href={handbookHref()}
              label="ハンドブック"
              description="学習要領ごとに、コマンドと出力の例で流れを説明。試す手順つき"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
            <ListItem
              href={glossaryHref}
              label="用語集"
              description="問題に出る用語の短い説明と出典"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
            <ListItem
              href={compareHref()}
              label="似た語の比較表"
              description="取り違えやすい語の違いを表で。出典つき"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
            <ListItem
              href={guideHref}
              label="Kubernetes とこのサイト"
              description="何を学ぶのか・試験の説明・問題の出典"
              endContent={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              }
            />
          </List>
        </div>

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

      <BottomTabs current="learn" reviewCount={dueReviewCount(progress, new Date())} />
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
  // 模擬試験用の問題はこの画面では読まないので、数は id から数える
  const dueCount = dueReviewCount(progress, new Date());
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
            {meta.week !== 1 && <Crumbs items={[{ name: `第 ${meta.week} 週 ${meta.title}` }]} />}
            <SiteHeading meta={meta} />
            <Text type="supporting">
              第 {meta.week} 週 · {meta.domain} · {meta.area} · {weekRange(s.start, meta.week)}
            </Text>
            <WeekHeading meta={meta} desk />
          </VStack>
          <HStack gap={6} wrap="wrap">
            <Text type="supporting">
              今日 <Text weight="semibold">{goalLabel(s.today, s.goal)}</Text>
            </Text>
            <Text type="supporting">
              連続 <Text weight="semibold">{s.streak} 日</Text>
            </Text>
            <Text type="supporting">
              {s.examDays === null ? (
                <ExamDays days={null} />
              ) : s.examDays > 0 ? (
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
            <PreRead meta={meta} />
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
                  <h2 className="h-sm">今日の復習 {dueCount} 問</h2>
                  <Button size="sm" variant={dueCount > 0 ? 'primary' : 'secondary'} label={dueCount > 0 ? '始める' : '見る'} href={reviewHref} />
                </HStack>
                <Text type="supporting">
                  {dueCount > 0
                    ? [...due.slice(0, 3).map((r) => r.lesson.title), ...(due.length < dueCount ? ['模擬試験の問題'] : [])]
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
