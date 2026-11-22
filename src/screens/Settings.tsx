import { useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { DateInput, type DateInputProps } from '@astryxdesign/core/DateInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { TimeInput, type TimeInputProps } from '@astryxdesign/core/TimeInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { downloadProgress } from '../lib/download';
import { clearExam } from '../lib/examSave';
import {
  COLOR_MODES,
  GOAL_CHOICES,
  WEEKLY_DAY_CHOICES,
  colorMode,
  type ColorMode,
  examDate,
  goalXp,
  parseProgressText,
  planStart,
  resetProgress,
  saveProgress,
  setProfile,
  type Progress,
} from '../lib/progress';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const COLOR_MODE_LABEL: Record<ColorMode, string> = { system: '端末に合わせる', light: 'ライト', dark: 'ダーク' };

/** 読み込むファイルの大きさの上限 */
const MAX_IMPORT_BYTES = 1024 * 1024;

type Props = { progress: Progress; updateProgress: (fn: (p: Progress) => Progress) => void };

/** 曜日 (Date#getDay の順) と、週の目標の日数ごとに最初に選んでおく曜日 */
const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_DAYS: Record<number, number[]> = { 1: [6], 2: [3, 6], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

/** 学ぶ予定を .ics でカレンダーに入れる。作る関数 (src/lib/ics.ts) は押したときに読む */
function CalendarPlan({ weeklyDays }: { weeklyDays: number | undefined }) {
  const [time, setTime] = useState('20:00');
  const [mode, setMode] = useState<'daily' | 'days'>(weeklyDays && weeklyDays < 7 ? 'days' : 'daily');
  const [days, setDays] = useState<string[]>(() => (DEFAULT_DAYS[weeklyDays ?? 7] ?? DEFAULT_DAYS[7]).map(String));
  const [error, setError] = useState<string | null>(null);
  const picked = mode === 'daily' ? DEFAULT_DAYS[7] : days.map(Number);
  const onDownload = async () => {
    setError(null);
    try {
      const ics = await import('../lib/ics');
      ics.downloadIcs(ics.buildIcs({ time, days: picked, timeZone: ics.deviceTimeZone(), now: new Date(), uid: ics.newUid() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '作れませんでした');
    }
  };
  return (
    <Card padding={4}>
      <VStack gap={4}>
        <VStack gap={1}>
          <h2 className="h-sm">カレンダーに学ぶ予定を入れる</h2>
          <Text type="supporting">決まった時刻に 30 分の予定を繰り返す .ics のファイルを作ります。カレンダーのアプリで開くと予定に入ります。中身はこのサイトの URL と短い文だけで、記録は入れません。</Text>
        </VStack>
        <TimeInput label="時刻" value={time as TimeInputProps['value']} onChange={(v) => setTime(v ? v.slice(0, 5) : '20:00')} width={160} />
        <SegmentedControl label="繰り返し" value={mode} onChange={(v) => setMode(v as 'daily' | 'days')}>
          <SegmentedControlItem value="daily" label="毎日" />
          <SegmentedControlItem value="days" label="曜日を選ぶ" />
        </SegmentedControl>
        {mode === 'days' && (
          <CheckboxList
            label="学ぶ曜日"
            description={weeklyDays ? `週の目標は ${weeklyDays} 日です。いま ${days.length} 日を選んでいます` : `いま ${days.length} 日を選んでいます`}
            value={days}
            onChange={setDays}
          >
            {WEEKDAY_ORDER.map((d) => (
              <CheckboxListItem key={d} value={String(d)} label={`${WEEKDAY_NAMES[d]}曜日`} />
            ))}
          </CheckboxList>
        )}
        <div>
          <Button label="予定をダウンロード (.ics)" onClick={onDownload} isDisabled={picked.length === 0} />
        </div>
        {error && <Banner status="error" title="作れませんでした" description={error} collapsible={false} />}
      </VStack>
    </Card>
  );
}

function summary(p: Progress) {
  const lessons = Object.values(p.lessons).filter((l) => l.done).length;
  const answers = Object.keys(p.answers).length;
  const read = Object.values(p.handbook ?? {}).filter((h) => h.done).length;
  return `完了したレッスン ${lessons} · 答えた問題 ${answers} · 合計 ${p.xp.total} XP · ハンドブックの確認済み ${read}`;
}

function Body({ progress, updateProgress }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<Progress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onFile = async (f: File | File[] | null) => {
    const one = Array.isArray(f) ? (f[0] ?? null) : f;
    setFile(one);
    setLoadError(null);
    setLoaded(null);
    setDone(null);
    if (!one) return;
    if (one.size > MAX_IMPORT_BYTES) {
      setLoadError('ファイルが大きすぎます (1 MB まで)。クラネイで書き出した JSON のファイルを選んでください。');
      return;
    }
    let text: string;
    try {
      text = await one.text();
    } catch {
      setLoadError('ファイルを読めませんでした。');
      return;
    }
    const parsed = parseProgressText(text);
    if (!parsed) {
      setLoadError('このファイルは読めませんでした。クラネイで書き出した JSON のファイルを選んでください。');
      return;
    }
    setLoaded(parsed);
  };

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">設定</h1>
      </VStack>

      <Card padding={4}>
        <VStack gap={4}>
          <h2 className="h-sm">学習の目標</h2>
          <VStack gap={1.5}>
            <Text weight="medium">1 日の目標</Text>
            <SegmentedControl
              label="1 日の目標 XP"
              value={String(goalXp(progress))}
              onChange={(v) => updateProgress((p) => setProfile(p, { dailyGoalXp: Number(v) }))}
            >
              {GOAL_CHOICES.map((g) => (
                <SegmentedControlItem key={g} value={String(g)} label={`${g} XP`} />
              ))}
            </SegmentedControl>
            <Text type="supporting">1 問正解で 3 XP、実習で 10 XP です。</Text>
          </VStack>
          <VStack gap={1.5}>
            <Text weight="medium">週の目標</Text>
            <SegmentedControl
              label="週に学ぶ日数"
              value={String(progress.profile?.weeklyDays ?? 0)}
              onChange={(v) => updateProgress((p) => setProfile(p, { weeklyDays: Number(v) || undefined }))}
            >
              <SegmentedControlItem value="0" label="なし" />
              {WEEKLY_DAY_CHOICES.map((d) => (
                <SegmentedControlItem key={d} value={String(d)} label={`${d}`} />
              ))}
            </SegmentedControl>
            <Text type="supporting">週に何日学ぶか (日)。決めると、ホームに今週 (月曜から) の学んだ日の数が出ます。</Text>
          </VStack>
          <DateInput
            label="受験日"
            description="決めると、ホームと進捗に試験までの日数が出ます"
            value={examDate(progress) as DateInputProps['value']}
            onChange={(v) => updateProgress((p) => setProfile(p, { examDate: v }))}
            hasClear
            format="date"
            width={240}
          />
          <DateInput
            label="学習の開始日"
            description={progress.profile?.startDate ? '週の日付をこの日から 7 日ずつ数えます。消すと初めて学んだ日から数えます' : '週の日付をこの日から 7 日ずつ数えます。決めていないので、初めて学んだ日 (まだなら今日) から数えています'}
            value={planStart(progress, new Date()) as DateInputProps['value']}
            onChange={(v) => updateProgress((p) => setProfile(p, { startDate: v }))}
            hasClear={progress.profile?.startDate !== undefined}
            format="date"
            width={240}
          />
        </VStack>
      </Card>

      <CalendarPlan weeklyDays={progress.profile?.weeklyDays} />

      <Card padding={4}>
        <VStack gap={1.5}>
          <h2 className="h-sm">画面の色</h2>
          <SegmentedControl label="画面の色" value={colorMode(progress)} onChange={(v) => updateProgress((p) => setProfile(p, { colorMode: v as ColorMode }))}>
            {COLOR_MODES.map((m) => (
              <SegmentedControlItem key={m} value={m} label={COLOR_MODE_LABEL[m]} />
            ))}
          </SegmentedControl>
          <Text type="supporting">このブラウザの記録に残ります。端末に合わせると、OS のライト・ダークの設定に従います。</Text>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={4}>
          <h2 className="h-sm">記録</h2>
          <Text type="supporting">{summary(progress)}</Text>
          <Text type="supporting">記録はこのブラウザ (localStorage) にだけあります。端末を変えるときは、書き出したファイルを新しい端末で読み込みます。</Text>
          <div>
            <Button label="記録を書き出す (JSON)" onClick={() => downloadProgress(progress, new Date())} />
          </div>
          <FileInput label="記録を読み込む" value={file} onChange={onFile} accept=".json,application/json" />
          {loadError && <Banner status="error" title="読み込めませんでした" description={loadError} collapsible={false} />}
          {loaded && (
            <Banner
              status="warning"
              title="今の記録を、読み込んだ記録で置き換えますか?"
              description={`読み込んだ記録: ${summary(loaded)}`}
              collapsible={false}
              endContent={
                <HStack gap={2}>
                  <Button size="sm" label="やめる" onClick={() => onFile(null)} />
                  <Button
                    size="sm"
                    variant="primary"
                    label="置き換える"
                    onClick={() => {
                      // 目標と受験日を変えたことの無い端末の書き出しなら、今の設定を引き継ぐ。
                      // 画面の色はこの端末の見た目の設定なので、読み込んでも今の端末の色を残す
                      const base = loaded.profile ? loaded : { ...loaded, profile: progress.profile };
                      const next = base.profile ? setProfile(base, { colorMode: colorMode(progress) }) : base;
                      if (!saveProgress(next)) {
                        setLoadError('このブラウザに保存できませんでした (容量の上限やプライベートモードなど)。今の記録はそのままです。');
                        setLoaded(null);
                        return;
                      }
                      updateProgress(() => next);
                      setFile(null);
                      setLoaded(null);
                      setDone('読み込んだ記録に置き換えました。');
                    }}
                  />
                </HStack>
              }
            />
          )}
          {done && <Banner status="success" title={done} collapsible={false} />}
          <div>
            <Button variant="destructive" label="記録を消す" onClick={() => setConfirmReset(true)} />
          </div>
        </VStack>
      </Card>

      <AlertDialog
        isOpen={confirmReset}
        onOpenChange={setConfirmReset}
        title="記録を消しますか?"
        description="完了したレッスン・XP・連続日数・問題ごとの正誤・模擬試験の結果・ハンドブックの読んだ記録を消します。目標・受験日・画面の色の設定は残ります。消す前に書き出しておくと、あとで読み込んで戻せます。"
        actionLabel="消す"
        cancelLabel="やめる"
        onAction={() => {
          updateProgress((p) => resetProgress(p));
          // 途中の模擬試験も消す (記録を消したあとに、前の答えで続きから解けないように)
          clearExam();
          setConfirmReset(false);
          setDone('記録を消しました。');
        }}
      />
    </VStack>
  );
}

export default function Settings(props: Props) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="settings" progress={props.progress} />}>
        <div className="desk">
          <div className="about">
            <Body {...props} />
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
        <Body {...props} />
      </main>
      <BottomTabs current="config" reviewCount={dueReviewCount(props.progress, new Date())} />
    </div>
  );
}
