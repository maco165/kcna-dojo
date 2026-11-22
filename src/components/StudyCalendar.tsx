import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { LEVEL_FLOORS, calendarWeeks, cellLabel, reviewForecast, CALENDAR_WEEKS, FORECAST_DAYS } from '../lib/calendar';
import type { Progress } from '../lib/progress';

const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** 過去 26 週の学んだ日のマス。色だけに頼らず、マスごとに日付と数の読み上げ (aria-label) と title を付ける */
export function StudyCalendar({ progress, now }: { progress: Progress; now: Date }) {
  const weeks = calendarWeeks(progress, now);
  const cells = weeks.flat().filter((c) => !c.future);
  const studied = cells.filter((c) => c.level > 0).length;
  const legend = ['学んでいない', ...LEVEL_FLOORS.map((f, i) => (i === LEVEL_FLOORS.length - 1 ? `${f} 問から` : `${f}〜${LEVEL_FLOORS[i + 1] - 1} 問`))];
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <h2 className="h-sm">学んだ日 (過去 {CALENDAR_WEEKS} 週)</h2>
          <Text type="supporting">{`${studied} 日 · ${md(cells[0].day)}〜`}</Text>
        </HStack>
        <div className="cal" role="list" aria-label={`過去 ${CALENDAR_WEEKS} 週の学んだ日。左が古く、縦は月曜から日曜`}>
          {weeks.flat().map((c) =>
            c.future ? (
              <span key={c.day} className="cal__cell cal__cell--future" aria-hidden="true" />
            ) : (
              <span key={c.day} role="listitem" className={`cal__cell cal__cell--l${c.level}`}>
                <span role="img" className="cal__mark" aria-label={cellLabel(c)} title={cellLabel(c)} />
              </span>
            ),
          )}
        </div>
        <HStack gap={1.5} vAlign="center" wrap="wrap">
          <Text type="supporting">少</Text>
          {legend.map((l, i) => (
            <span key={l} role="img" className={`cal__cell cal__cell--key cal__cell--l${i}`} aria-label={l} title={l} />
          ))}
          <Text type="supporting">多 (1 日に答えた問題の数)</Text>
        </HStack>
      </VStack>
    </Card>
  );
}

/** 明日から 14 日の復習の件数 (1・3・7 日後の予定から数える) */
export function ReviewForecast({ progress, now, isKnown }: { progress: Progress; now: Date; isKnown: (id: string) => boolean }) {
  const days = reviewForecast(progress, now, isKnown);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          <h2 className="h-sm">この先 {FORECAST_DAYS} 日の復習</h2>
          <Text type="supporting">{`計 ${total} 問 · ${md(days[0].day)}〜${md(days[days.length - 1].day)}`}</Text>
        </HStack>
        <div className="xp-chart xp-chart--forecast" role="img" aria-label={days.map((d) => `${md(d.day)} ${d.count} 問`).join('、')}>
          {days.map((d) => (
            <div key={d.day} className="xp-chart__col">
              {d.count > 0 && <span className="xp-chart__value">{d.count}</span>}
              <div className="xp-chart__bar" style={{ height: `${(d.count / max) * 70}%` }} />
              <span className="xp-chart__label">{Number(d.day.slice(8, 10))}</span>
            </div>
          ))}
        </div>
        <Text type="supporting">間違えた問題は 1・3・7 日後に出ます。数は今日までの答えで決まった予定で、今日の分は「今日の復習」にあります。</Text>
      </VStack>
    </Card>
  );
}
