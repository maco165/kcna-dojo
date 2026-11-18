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
import { HANDBOOK, findTopic, type HandbookStep } from '../content/handbook';
import { HANDBOOK_FIGURES } from '../content/handbookFigures';
import { EXAM_WEIGHTS } from '../lib/exam';
import type { Progress } from '../lib/progress';
import { guideHref, handbookHref, lessonHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

/** 1 段: 説明、コマンドかマニフェスト、出力の例 */
function Step({ step }: { step: HandbookStep }) {
  return (
    <div className="hb-step">
      <p className="hb-step__text">{step.text}</p>
      {step.code && <StepVisual code={step.code.text} language={step.code.language} />}
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

/** 目次: 分野ごとに細目のトピックを並べる */
function Index() {
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
      </div>
      {HANDBOOK.map((d) => (
        <section key={d.domain} className="hb-domain" aria-labelledby={`hb-${d.domain}`}>
          <h2 id={`hb-${d.domain}`} className="hb-domain__head">
            <span>{d.domain}</span>
            <span className="hb-muted">配点 {EXAM_WEIGHTS[d.domain]}%</span>
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
                  <span className="hb-topic__en" lang="en">
                    {t.competency}
                  </span>
                  <span className="hb-topic__title">{t.title}</span>
                  <span className="hb-topic__summary">{t.summary}</span>
                  <span className="hb-muted">
                    流れ {t.flow.length} 段 · 試す手順 {t.try.length} つ
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Topic({ id }: { id: string }) {
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
        <span className="hb-topic__en" lang="en">
          {t.competency}
        </span>
        <h1 id="hb-title" className="week-title">
          {t.title}
        </h1>
        <p className="hb-lead">{t.summary}</p>
      </div>
      {HANDBOOK_FIGURES[t.id] && <Diagram spec={HANDBOOK_FIGURES[t.id]} id={t.id} />}

      <section aria-labelledby="hb-flow" className="hb-section">
        <h2 id="hb-flow" className="hb-h2">
          全体の流れ
        </h2>
        <p className="hb-muted">流れのコードは説明のための例です。手元で試すときは、下の「試したいなら」の手順 (名前空間 try-kcna の中で試して後片付けまでする) を使ってください。</p>
        <ol className="hb-flow">
          {t.flow.map((s, i) => (
            <li key={i}>
              <Step step={s} />
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
                  <Step step={s} />
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

export default function Handbook({ progress, topicId }: { progress: Progress; topicId?: string }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const body = topicId ? <Topic id={topicId} /> : <Index />;
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
