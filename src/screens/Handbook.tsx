import { AppShell } from '@astryxdesign/core/AppShell';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import Diagram, { DiagramThumb } from '../components/Diagram';
import StepVisual from '../components/StepVisual';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueQuestions, findLesson } from '../content';
import { APPENDIX, HANDBOOK, findTopic, type HandbookStep } from '../content/handbook';
import { HANDBOOK_FIGURES } from '../content/handbookFigures';
import { EXAM_WEIGHTS } from '../lib/exam';
import { markHandbookSeen, setHandbookDone, type HandbookRecord, type Progress } from '../lib/progress';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { glossaryTermHref, guideHref, handbookHref, lessonHref } from '../lib/route';
import glossary from '../content/glossary.json';
import type { GlossaryTerm } from '../lib/glossary';
import { makeTermLinker, termNames, type TermPiece } from '../lib/termLinks';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const TERM_NAMES = termNames((glossary as { terms: GlossaryTerm[] }).terms);

/** 本文。用語集にある語 (ページの中で最初の 1 回) を強調し、用語集のその語へのリンクにする */
function Prose({ pieces }: { pieces: TermPiece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <a key={i} className="hb-term" href={glossaryTermHref(p.id)}>
            {p.text}
          </a>
        ),
      )}
    </>
  );
}

/** 1 段: 説明、コマンドかマニフェスト、出力の例 */
function Step({ step, text }: { step: HandbookStep; text: TermPiece[] }) {
  return (
    <div className="hb-step">
      <p className="hb-step__text">
        <Prose pieces={text} />
      </p>
      {step.code && <StepVisual code={step.code.text} language={step.code.language} result={step.result} />}
      {step.code && <CodeBlock code={step.code.text} language={step.code.language} width="100%" size="sm" hasCopyButton />}
      {step.output && (
        <figure className="hb-output">
          <figcaption>出力の例 (名前・時刻などは環境で変わります)</figcaption>
          <pre tabIndex={0}>{step.output}</pre>
        </figure>
      )}
    </div>
  );
}

type Update = (fn: (p: Progress) => Progress) => void;

/** 目次のカードに添える読んだ記録 */
function readingLabel(rec: HandbookRecord | undefined, steps: number): string {
  if (rec?.done) return '確認済み';
  if (rec && rec.seen > 0) return `読みかけ ${Math.min(rec.seen, steps)} / ${steps} 段`;
  return '未読';
}

/**
 * 「全体の流れ」の各段が画面に入ったら、何段目まで読んだかを記録する (前より進んだときだけ)。
 * 画面には何も描かない
 */
function SeenTracker({ topicId, seen, updateProgress }: { topicId: string; seen: number; updateProgress: Update }) {
  const furthest = useRef(seen);
  useEffect(() => {
    const items = [...document.querySelectorAll<HTMLElement>('[data-flow-step]')];
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        let n = furthest.current;
        for (const e of entries) if (e.isIntersecting) n = Math.max(n, Number((e.target as HTMLElement).dataset.flowStep) + 1);
        if (n > furthest.current) {
          furthest.current = n;
          updateProgress((p) => markHandbookSeen(p, topicId, n, new Date()));
        }
      },
      // 画面の下の 2 割に入っただけでは読んだことにしない
      { rootMargin: '0px 0px -20% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [topicId, updateProgress]);
  return null;
}

/** 目次: 分野ごとに細目のトピックを並べる */
function Index({ progress }: { progress: Progress }) {
  const total = HANDBOOK.reduce((n, d) => n + d.topics.length, 0);
  const done = HANDBOOK.reduce((n, d) => n + d.topics.filter((t) => progress.handbook?.[t.id]?.done).length, 0);
  return (
    <div className="hb">
      <div className="hb-head">
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">ハンドブック</h1>
        <p className="hb-lead">
          学習要領 (KCNA の公開カリキュラムの細目) ごとに、公式のドキュメントに沿って、実際のコマンドと出力の例で全体の流れを説明します。それぞれに「試したいなら」の手順があり、名前空間 try-kcna
          の中で試して後片付けまでできます。問題を解く前の下調べにも、間違えたあとの見直しにも使えます。
        </p>
        <p className="hb-lead hb-muted">
          学習要領そのものと出典の考え方は <a href={guideHref}>Kubernetes とこのサイト</a> にあります。
        </p>
        <p className="hb-muted">
          確認済み {done} / {total} トピック
        </p>
      </div>
      {HANDBOOK.map((d) => (
        <section key={d.domain} className="hb-domain" aria-labelledby={`hb-${d.domain}`}>
          <h2 id={`hb-${d.domain}`} className="hb-domain__head">
            <span>{d.domain}</span>
            <span className="hb-muted">{d.domain === APPENDIX ? '資格の範囲の外' : `配点 ${EXAM_WEIGHTS[d.domain]}%`}</span>
          </h2>
          <ul className="hb-topics">
            {d.topics.map((t) => (
              <li key={t.id}>
                <a className="hb-topic" href={handbookHref(t.id)}>
                  {HANDBOOK_FIGURES[t.id] && (
                    <span className="hb-topic__thumb">
                      <DiagramThumb spec={HANDBOOK_FIGURES[t.id]} />
                    </span>
                  )}
                  <span className="hb-topic__en" lang={d.domain === APPENDIX ? undefined : 'en'}>
                    {t.competency}
                  </span>
                  <span className="hb-topic__title">{t.title}</span>
                  <span className="hb-topic__summary">{t.summary}</span>
                  <span className="hb-muted">
                    流れ {t.flow.length} 段 · 試す手順 {t.try.length} つ
                  </span>
                  <span className={progress.handbook?.[t.id]?.done ? 'hb-topic__read hb-topic__read--done' : 'hb-topic__read'}>{readingLabel(progress.handbook?.[t.id], t.flow.length)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Topic({ id, progress, updateProgress }: { id: string; progress: Progress; updateProgress: Update }) {
  const [openedRecord] = useState(() => progress.handbook?.[id]);
  const found = findTopic(id);
  if (!found) {
    return (
      <div className="hb">
        <h1 className="week-title">見つかりませんでした</h1>
        <p>
          <a href={handbookHref()}>ハンドブックの目次へ</a>
        </p>
      </div>
    );
  }
  const { topic: t, prev, next } = found;
  const lessons = t.lessons.map((l) => findLesson(l)).filter((x) => x !== undefined);
  // 本文の順に、語ごとに最初の 1 回だけリンクにする (描く前にまとめて決めるので、何度描いても同じ)
  const link = makeTermLinker(TERM_NAMES);
  const rec = progress.handbook?.[t.id];
  // 続きからの案内は、開いたときの記録で出す (読み進めるたびに出し入れすると、本文がずれる)
  const opened = openedRecord;
  const prose = { summary: link(t.summary), flow: t.flow.map((s) => link(s.text)), tries: t.try.map((x) => x.steps.map((s) => link(s.text))) };
  return (
    <article className="hb" aria-labelledby="hb-title">
      <nav aria-label="パンくず" className="hb-crumbs">
        <ol>
          <li>
            <a href={handbookHref()}>ハンドブック</a>
          </li>
          <li>{t.domain}</li>
          <li aria-current="page">{t.title}</li>
        </ol>
      </nav>
      <div className="hb-head">
        <span className="hb-topic__en" lang={t.domain === APPENDIX ? undefined : 'en'}>
          {t.competency}
        </span>
        <h1 id="hb-title" className="week-title">
          {t.title}
        </h1>
        <p className="hb-lead">
          <Prose pieces={prose.summary} />
        </p>
        {opened && !opened.done && !rec?.done && opened.seen > 0 && opened.seen < t.flow.length && (
          <HStack gap={3} vAlign="center" className="hb-resume">
            <Text type="supporting">前回は全体の流れの {opened.seen} / {t.flow.length} 段まで読みました</Text>
            <Button
              variant="secondary"
              size="sm"
              label="続きから"
              onClick={() => document.querySelector(`[data-flow-step="${opened.seen}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
            />
          </HStack>
        )}
      </div>
      {HANDBOOK_FIGURES[t.id] && <Diagram spec={HANDBOOK_FIGURES[t.id]} id={t.id} />}

      <section aria-labelledby="hb-flow" className="hb-section">
        <h2 id="hb-flow" className="hb-h2">
          全体の流れ
        </h2>
        <p className="hb-muted">流れのコードは説明のための例です。手元で試すときは、下の「試したいなら」の手順 (名前空間 try-kcna の中で試して後片付けまでする) を使ってください。</p>
        <ol className="hb-flow">
          {t.flow.map((s, i) => (
            <li key={i} data-flow-step={i}>
              <Step step={s} text={prose.flow[i]} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="hb-try" className="hb-section">
        <h2 id="hb-try" className="hb-h2">
          試したいなら
        </h2>
        <p className="hb-muted">手元のクラスタ (k3s など) で、名前空間 try-kcna の中で試します。最後の手順で後片付けをします。</p>
        {t.try.map((x, i) => (
          <details key={i} className="hb-try" open={i === 0}>
            <summary>{x.goal}</summary>
            <ol className="hb-flow">
              {x.steps.map((s, j) => (
                <li key={j}>
                  <Step step={s} text={prose.tries[i][j]} />
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>

      {lessons.length > 0 && (
        <section aria-labelledby="hb-lessons" className="hb-section">
          <h2 id="hb-lessons" className="hb-h2">
            問題で練習する
          </h2>
          <ul className="gloss-chips">
            {lessons.map((l) => (
              <li key={l!.lesson.id}>
                <a className="gloss-chip" href={lessonHref(l!.lesson.id)}>{`第 ${l!.week} 週 ${l!.lesson.title}`}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="hb-src" className="hb-section">
        <h2 id="hb-src" className="hb-h2">
          出典 (公式のドキュメント)
        </h2>
        <ul className="hb-sources">
          {t.sources.map((s) => (
            <li key={s.url}>
              <Link href={s.url} isExternalLink newTabLabel="(新しいタブで開きます)">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hb-done" className="hb-section hb-done">
        <h2 id="hb-done" className="hb-h2">
          読んだ記録
        </h2>
        {/* ボタンは 1 つのまま名前だけ変える (押したボタンが消えてフォーカスを失わないように)。状態の文は読み上げで知らせる */}
        <HStack gap={3} vAlign="center">
          {rec?.done && <StatusDot variant="success" label="確認済み" />}
          <Text type={rec?.done ? undefined : 'supporting'} aria-live="polite">
            {rec?.done ? '確認済み' : `全体の流れ ${Math.min(rec?.seen ?? 0, t.flow.length)} / ${t.flow.length} 段まで読みました`}
          </Text>
          <Button
            variant={rec?.done ? 'secondary' : 'primary'}
            size="sm"
            label={rec?.done ? '確認済みを取り消す' : '確認済みにする'}
            onClick={() => updateProgress((p) => setHandbookDone(p, t.id, !rec?.done, new Date()))}
          />
        </HStack>
      </section>
      <SeenTracker topicId={t.id} seen={rec?.seen ?? 0} updateProgress={updateProgress} />

      <nav aria-label="前後のトピック" className="hb-pager">
        {prev ? (
          <a href={handbookHref(prev.id)}>
            <span className="hb-muted">前へ</span>
            {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a href={handbookHref(next.id)} className="hb-pager__next">
            <span className="hb-muted">次へ</span>
            {next.title}
          </a>
        )}
      </nav>
    </article>
  );
}

export default function Handbook({ progress, updateProgress, topicId }: { progress: Progress; updateProgress: Update; topicId?: string }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const body = topicId ? <Topic id={topicId} progress={progress} updateProgress={updateProgress} /> : <Index progress={progress} />;
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="handbook" progress={progress} />}>
        <div className="desk">{body}</div>
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
      <main className="page__section">{body}</main>
      <BottomTabs current="handbook" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}
