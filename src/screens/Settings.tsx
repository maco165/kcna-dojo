import { useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { DateInput, type DateInputProps } from '@astryxdesign/core/DateInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { downloadProgress } from '../lib/download';
import {
  GOAL_CHOICES,
  examDate,
  goalXp,
  parseProgressText,
  resetProgress,
  setProfile,
  type Progress,
} from '../lib/progress';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Props = { progress: Progress; updateProgress: (fn: (p: Progress) => Progress) => void };

function summary(p: Progress) {
  const lessons = Object.values(p.lessons).filter((l) => l.done).length;
  const answers = Object.keys(p.answers).length;
  return `完了したレッスン ${lessons} · 答えた問題 ${answers} · 合計 ${p.xp.total} XP`;
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
    const parsed = parseProgressText(await one.text());
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
          <DateInput
            label="受験日"
            description="試験までの日数に使います"
            value={examDate(progress) as DateInputProps['value']}
            onChange={(v) => v && updateProgress((p) => setProfile(p, { examDate: v }))}
            format="date"
            width={240}
          />
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
                      updateProgress(() => loaded);
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
        description="完了したレッスン・XP・連続日数・問題ごとの正誤を消します。目標と受験日の設定は残ります。消す前に書き出しておくと、あとで読み込んで戻せます。"
        actionLabel="消す"
        cancelLabel="やめる"
        onAction={() => {
          updateProgress((p) => resetProgress(p));
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
      <BottomTabs current="config" />
    </div>
  );
}
