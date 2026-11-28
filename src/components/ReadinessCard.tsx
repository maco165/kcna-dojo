// 進捗の画面の「受験の目安」。足りない細目と、そこへのレッスン・ハンドブックのリンク、模擬試験の直近の結果を出す。
// 計算は src/lib/readiness.ts。合格を保証するものではないことを、いつも添える
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { findLesson } from '../content';
import { PASS_MARK } from '../lib/exam';
import { pctOf } from '../lib/mastery';
import { COMPETENCY_TARGET, FRESH_SETS, RECENT_EXAMS, type Readiness } from '../lib/readiness';
import { examHref, guideHref, handbookHref, lessonHref } from '../lib/route';

const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function ReadinessCard({ r }: { r: Readiness }) {
  const fresh = FRESH_SETS.map((n) => `第 ${n} 回`).join('・');
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <h2 className="h-sm">受験の目安</h2>
          <Text type="supporting">
            {`学習要領の 13 細目のどれも、その細目のレッスンの問題の ${pct(COMPETENCY_TARGET)} 以上を「2 回続けて正解」にし、模擬試験の直近 ${RECENT_EXAMS} 回がどれも ${pct(PASS_MARK)} 以上 (うち 1 回以上は初見の問題だけの ${fresh}) なら、目安に届いたとします。合格を約束するものではありません。`}
          </Text>
        </VStack>
        <p className="readiness__state" aria-live="polite">
          <StatusDot variant={r.ready ? 'success' : 'neutral'} label={r.ready ? '届いた' : 'まだ'} />
          <Text weight="semibold">{r.ready ? '目安に届いています' : `まだです (足りない細目 ${r.short.length} · 模擬試験 ${r.exam.ok ? '届いた' : 'まだ'})`}</Text>
        </p>
        {r.short.length > 0 && (
          <VStack gap={1}>
            <h3 className="h-xs">足りない細目</h3>
            <ul className="readiness__list">
              {r.short.map((c) => (
                <li key={c.en}>
                  <Text weight="medium">{`${c.ja} (${c.en})`}</Text>
                  <Text type="supporting">{`2 回続けて正解 ${c.twice} / ${c.total} 問 (${pctOf(c.twice, c.total)}%)`}</Text>
                  <span className="readiness__links">
                    {c.lessons.map((id) => {
                      const f = findLesson(id);
                      return f ? (
                        <a key={id} className="gloss-chip" href={lessonHref(id)}>
                          {`第 ${f.week} 週 ${f.lesson.title}`}
                        </a>
                      ) : null;
                    })}
                    <a className="gloss-chip" href={handbookHref(c.topic)}>
                      {`ハンドブック: ${c.ja}`}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </VStack>
        )}
        <VStack gap={1}>
          <h3 className="h-xs">模擬試験の直近 {RECENT_EXAMS} 回</h3>
          {r.exam.recent.length === 0 ? (
            <Text type="supporting">
              まだ受けていません。<a href={examHref}>模擬試験へ</a>
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
        <Text type="supporting">
          {`${pct(PASS_MARK)} は LF の多肢選択式の試験に共通の合格の目安で、KCNA と名指しの数字ではありません。`}
          <a href={`${guideHref}#exam-day`}>申し込みから結果までの案内</a>
        </Text>
      </VStack>
    </Card>
  );
}
