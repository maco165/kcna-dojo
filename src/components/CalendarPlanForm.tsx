import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { normalizeTime } from '../lib/timeText';

/** 曜日 (Date#getDay の順) と、週の目標の日数ごとに最初に選んでおく曜日 */
const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_DAYS: Record<number, number[]> = { 1: [6], 2: [3, 6], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

/**
 * 学ぶ予定の .ics の入力欄 (時刻・繰り返し・曜日)。設定の画面で「予定を作る」を押したときに読む (設定の画面を軽くするため)。
 * 作る関数 (src/lib/ics.ts) はダウンロードを押したときに読む
 */
export default function CalendarPlanForm({ weeklyDays }: { weeklyDays: number | undefined }) {
  const [time, setTime] = useState('20:00');
  const [mode, setMode] = useState<'daily' | 'days'>(weeklyDays && weeklyDays < 7 ? 'days' : 'daily');
  const [days, setDays] = useState<string[]>(() => (DEFAULT_DAYS[weeklyDays ?? 7] ?? DEFAULT_DAYS[7]).map(String));
  const [error, setError] = useState<string | null>(null);
  const picked = mode === 'daily' ? DEFAULT_DAYS[7] : days.map(Number);
  const hhmm = normalizeTime(time);
  const onDownload = async () => {
    setError(null);
    try {
      const ics = await import('../lib/ics');
      ics.downloadIcs(ics.buildIcs({ time: hhmm ?? '', days: picked, timeZone: ics.deviceTimeZone(), now: new Date(), uid: ics.newUid() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '作れませんでした');
    }
  };
  return (
    <VStack gap={4}>
      <TextInput
        label="時刻"
        description="24 時間の HH:MM (例 20:00)"
        value={time}
        onChange={setTime}
        inputMode="numeric"
        autoComplete="off"
        width={160}
        status={hhmm ? undefined : { type: 'error', message: '00:00〜23:59 で入れてください' }}
      />
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
        <Button variant="primary" label="予定をダウンロード (.ics)" onClick={onDownload} isDisabled={picked.length === 0 || !hhmm} />
      </div>
      {error && <Banner status="error" title="作れませんでした" description={error} collapsible={false} />}
    </VStack>
  );
}

