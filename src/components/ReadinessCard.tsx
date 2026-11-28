// 進捗の画面の「受験の目安」。状態の 1 行と、足りない細目のうち割合の低い 3 つを出し、残りは畳む。
// 細目ごとのリンクは「次に解くレッスン」とハンドブックの 1 つずつ。計算は src/lib/readiness.ts。合格を保証するものではないことを、いつも添える
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { findLesson } from '../content';
import { PASS_MARK } from '../lib/exam';
import { pctOf } from '../lib/mastery';
import { COMPETENCY_TARGET, FRESH_SETS, RECENT_EXAMS, type CompetencyReadiness, type Readiness } from '../lib/readiness';
import { examHref, guideHref, handbookHref, lessonHref } from '../lib/route';

const pct = (r: number) => `${Math.round(r * 100)}%`;
/** 開いたまま出す、足りない細目の数 */
export const SHOWN_SHORT = 3;

function Short({ items }: { items: CompetencyReadiness[] }) {
  return (
    <ul className="readiness__list">
      {items.map((c) => {
        const next = c.next ? findLesson(c.next) : undefined;
        return (
          <li key={c.en}>
            <h4 className="h-xs">{`${c.ja} (${c.en})`}</h4>
            <Text type="supporting">{`2 回続けて正解 ${c.twice} / ${c.total} 問 (${pctOf(c.twice, c.total)}%)`}</Text>
            <span className="readiness__links">
              {next && (
                <a className="gloss-chip" href={lessonHref(c.next!)}>
                  {`次に解く: 第 ${next.week} 週 ${next.lesson.title}`}
                </a>
              )}
              <a className="gloss-chip" href={handbookHref(c.topic)}>
                {`ハンドブック: ${c.ja}`}
              </a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ReadinessCard({ r }: { r: Readiness }) {
  const fresh = FRESH_SETS.map((n) => `第 ${n} 回`).join('・');
  const shown = r.short.slice(0, SHOWN_SHORT);
  const rest = r.short.slice(SHOWN_SHORT);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <h2 className="h-sm">受験の目安</h2>
        <p className="readiness__state" aria-live="polite">
          <StatusDot variant={r.ready ? 'success' : 'neutral'} label={r.ready ? '届いた' : 'まだ'} />
          <Text weight="semibold">{r.ready ? '目安に届いています' : `まだです (足りない細目 ${r.short.length} · 模擬試験 ${r.exam.ok ? '届いた' : 'まだ'})`}</Text>
        </p>
        <Text type="supporting">合格を約束するものではありません。模擬試験は、本番の問題とは違います。</Text>
        {r.short.length > 0 && (
          <VStack gap={1}>
            <h3 className="h-xs">足りない細目 (割合の低い順)</h3>
            <Short items={shown} />
            {rest.length > 0 && (
              <details className="readiness__more">
                <summary>{`足りない細目をすべて見る (残り ${rest.length})`}</summary>
                <Short items={rest} />
              </details>
            )}
          </VStack>
        )}
        <VStack gap={1}>
          <h3 className="h-xs">模擬試験の直近 {RECENT_EXAMS} 回</h3>
          {r.exam.recent.length === 0 ? (
            <Text type="supporting">
              まだ受けていません。<a className="readiness__a" href={examHref}>模擬試験へ</a>
            </Text>
          ) : (
            <ul className="readiness__list">
              {r.exam.recent.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <Text>{`${e.set ? `第 ${e.set} 回${e.fresh ? ' (初見)' : ''}` : 'ランダム'} · ${e.correct} / ${e.total} 問 (${pct(e.rate)}) · ${e.ok ? '目安以上' : '目安より下'}`}</Text>
                </li>
              ))}
            </ul>
          )}
          {r.exam.recent.length > 0 && !r.exam.hasFresh && <Text type="supporting">{`直近 ${RECENT_EXAMS} 回に、初見の問題だけの回 (${fresh}) がありません。レッスンで見た問題は答えを覚えて解けるためです。`}</Text>}
        </VStack>
        <details className="readiness__more">
          <summary>目安の決め方</summary>
          <Text type="supporting">
            {`学習要領の 13 細目のどれも、その細目のレッスンの問題の ${pct(COMPETENCY_TARGET)} 以上を「2 回続けて正解」にし、模擬試験の直近 ${RECENT_EXAMS} 回がどれも ${pct(PASS_MARK)} 以上 (うち 1 回以上は初見の問題だけの ${fresh}) なら、目安に届いたとします。${pct(PASS_MARK)} は LF の多肢選択式の試験に共通の合格の目安で、KCNA と名指しの数字ではありません。`}
          </Text>
        </details>
        <Text type="supporting">
          <a className="readiness__a" href={`${guideHref}#exam-day`}>申し込みから結果までの案内</a>
        </Text>
      </VStack>
    </Card>
  );
}
