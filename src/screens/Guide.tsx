import { useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import Crumbs from '../components/Crumbs';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { WEEK_CONTENTS, findQuestion } from '../content/lessons';
import { WEEKS } from '../content/curriculum';
import glossary from '../content/glossary.json';
import {
  CHECKED_AT,
  CURRICULUM,
  CURRICULUM_VERSION,
  DEFINITION,
  EXAM_DAY,
  EXAM_DAY_CHECKED_AT,
  EXAM_FACTS,
  EXAM_PURPOSE,
  ORIGIN,
  PROVIDES,
  SAMPLE_QUESTION_ID,
  SOURCES,
  SOURCE_SITES,
  STUDY_MATERIALS,
  type Source,
} from '../content/guide';
import type { FillQuestion } from '../content/types';
import { contentStats } from '../lib/contentStats';
import { EXAM_WEIGHTS } from '../lib/exam';
import { gradeFill } from '../lib/grade';
import { NEW_ISSUE_URL } from '../lib/links';
import type { Progress } from '../lib/progress';
import { aboutHref, glossaryHref, handbookHref, handsOnHref, lessonHref, weekHref } from '../lib/route';
import { topicByCompetency } from '../content/handbook';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const STATS = contentStats(
  WEEK_CONTENTS,
  (glossary as { terms: unknown[] }).terms.length,
);
/** 週の番号の並びを「第 1〜4 週」「第 7 週」の形にする */
function weeksLabel(weeks: number[]): string {
  const lo = Math.min(...weeks);
  const hi = Math.max(...weeks);
  return lo === hi ? `第 ${lo} 週` : `第 ${lo}〜${hi} 週`;
}

/** 出典の内訳の帯に色を分けて出すホストの数 (残りは「そのほか」) */
const TOP_SOURCES = 3;

function Ext({ s }: { s: Source }) {
  return (
    <Link href={s.url} isExternalLink newTabLabel="(新しいタブで開きます)">
      {s.label}
    </Link>
  );
}

function Sources({ list, dark, checked = CHECKED_AT }: { list: Source[]; dark?: boolean; checked?: string }) {
  return (
    <p className={dark ? 'guide-src guide-src--dark' : 'guide-src'}>
      出典:{' '}
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <Ext s={s} />
        </span>
      ))}{' '}
      ({checked} に確認)
    </p>
  );
}

/** 背景のアニメーション: コンテナ (アプリ・ライブラリ・土台) がノードに置かれ、1 つ落ちると立て直される。SVG と CSS だけ */
function ClusterAnimation() {
  const pod = (x: number, cls: string) => (
    <g className={`guide-pod ${cls}`}>
      <rect x={x} y="300" width="68" height="100" rx="6" fill="#102A47" stroke="#3E9EFB" />
      <rect x={x + 8} y="310" width="52" height="22" rx="3" fill="#0064E0" />
      <rect x={x + 8} y="338" width="52" height="22" rx="3" fill="#1B4E86" />
      <rect x={x + 8} y="366" width="52" height="22" rx="3" fill="#24384D" />
    </g>
  );
  return (
    <svg className="guide-hero__bg" viewBox="0 240 390 270" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g fill="none" stroke="#2A3540" strokeWidth="1.5">
        <rect x="14" y="250" width="112" height="190" rx="10" />
        <rect x="139" y="250" width="112" height="190" rx="10" />
        <rect x="264" y="250" width="112" height="190" rx="10" />
      </g>
      <g fill="#1C2630">
        <rect x="22" y="412" width="96" height="18" rx="4" />
        <rect x="147" y="412" width="96" height="18" rx="4" />
        <rect x="272" y="412" width="96" height="18" rx="4" />
      </g>
      <g fill="#6F747C" fontFamily="SF Mono, Monaco, Consolas, monospace" fontSize="9">
        <text x="30" y="424">
          kernel
        </text>
        <text x="155" y="424">
          kernel
        </text>
        <text x="280" y="424">
          kernel
        </text>
        <text x="22" y="268">
          node-1
        </text>
        <text x="147" y="268">
          node-2
        </text>
        <text x="272" y="268">
          node-3
        </text>
      </g>
      {pod(36, 'guide-pod--1')}
      {pod(161, 'guide-pod--2')}
      {pod(286, 'guide-pod--3')}
      {pod(286, 'guide-pod--4')}
      <g className="guide-layers" fill="#AAAFB5" fontSize="9">
        <text x="108" y="324">
          アプリ
        </text>
        <text x="108" y="352">
          ライブラリ
        </text>
        <text x="108" y="380">
          土台
        </text>
      </g>
      <g fontFamily="SF Mono, Monaco, Consolas, monospace" fontSize="11">
        <text x="14" y="470" fill="#8A9099">
          あるべき状態
        </text>
        <text x="14" y="488" fill="#DFE2E5">
          replicas: 3
        </text>
        <text className="guide-now" x="200" y="488" fill="#3E9EFB">
          いま 3 / 3
        </text>
        <text className="guide-now-bad" x="200" y="488" fill="#FFB2B8">
          いま 2 / 3 → 立て直す
        </text>
      </g>
    </svg>
  );
}

/** その場で 1 問解ける見本 (実際の問題データから引く) */
function Sample() {
  const ref = findQuestion(SAMPLE_QUESTION_ID);
  const [picked, setPicked] = useState<string | null>(null);
  if (!ref || ref.question.type !== 'fill') return null;
  const q = ref.question as FillQuestion;
  const [before, after] = q.code.split('{{blank}}');
  const ok = picked !== null && gradeFill(q, picked);
  return (
    <div className="guide-sample">
      <span className="guide-sample__meta">試しに 1 問 · コマンドの穴埋め · 第 {ref.week} 週</span>
      <p className="guide-sample__prompt">{q.prompt}</p>
      <pre className="guide-sample__code">
        <span aria-hidden="true">$ </span>
        {before}
        <span className={picked === null ? 'guide-blank' : ok ? 'guide-blank guide-blank--ok' : 'guide-blank guide-blank--ng'}>{picked ?? '____'}</span>
        {after}
      </pre>
      <div role="group" aria-label="空欄の候補" className="guide-sample__choices">
        {(q.candidates ?? q.answers).map((c) => (
          <button key={c} type="button" className="guide-choice" aria-pressed={picked === c} onClick={() => setPicked(c)}>
            {c}
          </button>
        ))}
      </div>
      <p role="status" className={ok ? 'guide-sample__fb guide-sample__fb--ok' : 'guide-sample__fb guide-sample__fb--ng'}>
        {picked === null ? '' : ok ? `正解。${q.explanation}` : `${picked} は違います。${q.wrongNotes?.[picked] ?? ''} もう一度選べます。`}
      </p>
      {picked !== null && (
        <a className="guide-sample__more" href={lessonHref(ref.lesson.id)}>
          このレッスン ({ref.lesson.title}) を解く
        </a>
      )}
    </div>
  );
}

function Body() {
  const top = STATS.sources.slice(0, TOP_SOURCES);
  const rest = STATS.sources.slice(TOP_SOURCES);
  const restCount = rest.reduce((s, x) => s + x.count, 0);
  const share = (n: number) => `${((n / Math.max(1, STATS.questions)) * 100).toFixed(1)}%`;
  const sourceLabel = [...top.map((s) => `${s.host} ${s.count} 問`), `そのほか ${restCount} 問`].join('、');
  return (
    <div className="guide">
      <div className="guide-crumbs">
        <Crumbs items={[{ name: 'Kubernetes とこのサイト' }]} />
      </div>
      <section className="guide-hero" aria-labelledby="guide-title">
        <ClusterAnimation />
        <div className="guide-hero__fg">
          <ul className="guide-tags" aria-label="問題の種類">
            {['問題を解く前に', '穴埋め・4 択・実践・模擬試験'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h1 id="guide-title" className="guide-hero__title">
            Kubernetes を、
            <br />
            問題を解きながら根っこから。
          </h1>
          <Sample />
          <a className="guide-cta" href={weekHref(1)}>
            第 1 週から解き始める
          </a>
        </div>
        <p className="guide-hero__caption">背景: コンテナ (アプリ・ライブラリ・土台のレイヤー) がノードに置かれ、1 つ落ちると新しいものに立て直される</p>
      </section>

      <dl className="guide-stats" aria-label="このサイトの中身">
        <div>
          <dt>週</dt>
          <dd>{STATS.weeks}</dd>
        </div>
        <div>
          <dt>レッスン</dt>
          <dd>{STATS.lessons - STATS.labs}</dd>
        </div>
        <div>
          <dt>問</dt>
          <dd>{STATS.questions}</dd>
        </div>
        <div>
          <dt>語の用語集</dt>
          <dd>{STATS.terms}</dd>
        </div>
      </dl>

      <section className="guide-origin" aria-labelledby="guide-origin">
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke="#3E9EFB" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="32" cy="32" r="18" />
          <circle cx="32" cy="32" r="5" />
          <path d="M32 6v21M32 37v21M6 32h21M37 32h21M13.6 13.6l14.9 14.9M35.5 35.5l14.9 14.9M50.4 13.6 35.5 28.5M28.5 35.5 13.6 50.4" />
        </svg>
        <div className="guide-origin__text">
          <h2 id="guide-origin" className="guide-origin__label">
            Kubernetes という名前
          </h2>
          <p className="guide-origin__word">
            <span lang="en">{ORIGIN.word}</span> <span className="guide-origin__muted">{ORIGIN.meaning}</span>
          </p>
          <p className="guide-origin__muted">
            <span className="guide-mono guide-accent">K8s</span> は K と s の間の 8 文字を数えた略語 ·{' '}
            {ORIGIN.milestones.map((m, i) => (
              <span key={m.year}>
                {i > 0 && ' · '}
                <span className="guide-mono">{m.year}</span> {m.text}
              </span>
            ))}
          </p>
          <Sources list={ORIGIN.sources} dark />
        </div>
      </section>

      <div className="guide-body">
        <section aria-labelledby="guide-what" className="guide-section">
          <h2 id="guide-what" className="guide-h2">
            そもそも何をするものか
          </h2>
          <blockquote className="guide-quote">{DEFINITION}</blockquote>
          <h3 className="guide-h3">なぜ生まれたか: アプリの置き方の移り変わり</h3>
          <ol className="guide-eras">
            <li>
              <span className="guide-eras__name">1. 物理サーバー</span>
              <span>1 つのアプリが資源を食うと、隣が遅くなる</span>
            </li>
            <li>
              <span className="guide-eras__name">2. 仮想マシン</span>
              <span>分けられるが、VM ごとに OS を丸ごと持つ</span>
            </li>
            <li className="guide-eras__now">
              <span className="guide-eras__name">3. コンテナ</span>
              <span>OS を分け合って軽い。そのぶん数が増える</span>
            </li>
          </ol>
          <p>
            数が増えたコンテナを、人の手で 1 つずつ見張るのは無理があります。止まったら立て直し、混んだら振り分ける。その仕組みを組み込んだのが Kubernetes
            です。
          </p>
          <h3 className="guide-h3">いちばん大事な考え方</h3>
          <div className="guide-state">
            <span>
              <span className="guide-muted">あるべき状態</span>
              <span className="guide-mono">replicas: 3</span>
            </span>
            <svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M2 10h34M30 4l6 6-6 6" />
            </svg>
            <span>
              <span className="guide-muted">実際の状態</span>
              <span className="guide-mono">2 → 3 に戻す</span>
            </span>
          </div>
          <p>やることを手順で命じるのではなく、「こうあってほしい」を書いて渡す。Kubernetes はずれを見つけるたびに、実際の状態をそこへ近づけます。</p>
          <h3 className="guide-h3">Kubernetes がしてくれること</h3>
          <ul className="guide-rows">
            {PROVIDES.map((p) => (
              <li key={p.name}>
                <span className="guide-rows__name">{p.name}</span>
                <span className="guide-muted">{p.text}</span>
              </li>
            ))}
          </ul>
          <Sources list={[SOURCES.k8sOverview]} />
        </section>

        <section aria-labelledby="guide-path" className="guide-section">
          <h2 id="guide-path" className="guide-h2">
            学ぶ順番
          </h2>
          <p className="guide-muted">小さな部品から、大きな設計へ。{WEEKS.length} 週で一周します。</p>
          <ol className="guide-path">
            {WEEKS.map((w) => (
              <li key={w.week}>
                <span className="guide-mono guide-accent">{String(w.week).padStart(2, '0')}</span>
                <a href={weekHref(w.week)}>{w.title}</a>
                <span className="guide-muted">{w.goals[0]}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="guide-way" className="guide-section">
          <h2 id="guide-way" className="guide-h2">
            学び方
          </h2>
          <p className="guide-muted">レッスンは問題から始まります。読んでから解くか、解いてから読むかは、どちらでも進められます。</p>
          <ol className="guide-steps">
            <li>
              Kubernetes が初めての人は、週の一覧の「先に読む」から <a href={handbookHref()}>ハンドブック</a> のトピックを読む。触ったことがある人は、読まずに解き始めてよい
            </li>
            <li>その週のレッスンを解く。答えたあとに、解説と出典、出てきたコマンドの説明が出る</li>
            <li>間違えた問題は、答えたあとの「読み直す」からハンドブックと用語集に戻る</li>
            <li>
              初めての人は <a href={handsOnHref()}>実践</a> で、自分の端末で動かして確かめる。問題だけ解きたい人は、問題演習だけで進めてよい
            </li>
            <li>間違えた問題は 1・3・7 日後に復習に出る。8 週を終えたら模擬試験で仕上げる</li>
          </ol>
        </section>

        <section aria-labelledby="guide-outline" className="guide-section guide-section--wide">
          <h2 id="guide-outline" className="guide-h2">
            学習要領と、このサイトで学ぶ場所
          </h2>
          <p className="guide-muted">
            KCNA の公開カリキュラムが「合格者に期待する知識・技能」として挙げる細目です。試験を受けない人にも、Kubernetes
            とクラウドネイティブの基礎の地図として使えます。
          </p>
          <div className="guide-outline">
            {CURRICULUM.map((c) => (
              <section key={c.domain} aria-label={c.domain} className="guide-outline__domain">
                <h3 className="guide-outline__head">
                  <span>{c.domain}</span>
                  <span className="guide-muted">配点 {EXAM_WEIGHTS[c.domain]}%</span>
                </h3>
                <table className="guide-outline__table">
                  <thead>
                    <tr>
                      <th scope="col">細目 (原文)</th>
                      <th scope="col">日本語</th>
                      <th scope="col">このサイト</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.competencies.map((x) => (
                      <tr key={x.en}>
                        <td lang="en">
                          {topicByCompetency(x.en) ? <a href={handbookHref(topicByCompetency(x.en)!.id)}>{x.en}</a> : x.en}
                        </td>
                        <td>{x.ja}</td>
                        <td>
                          {x.weeks.map((w, i) => (
                            <span key={w}>
                              {i > 0 && '・'}
                              <a href={weekHref(w)}>第 {w} 週</a>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
          <Sources
            list={[
              {
                ...SOURCES.curriculum,
                label: `${SOURCES.curriculum.label} (${CURRICULUM_VERSION})`,
              },
              SOURCES.kcnaJp,
            ]}
          />
        </section>

        <section aria-labelledby="guide-exam" className="guide-section guide-section--card">
          <div className="guide-cols">
            <div className="guide-col">
              <p className="guide-kicker">KCNA-JP を受ける人へ</p>
              <h2 id="guide-exam" className="guide-h2">
                どんな試験か
              </h2>
              <p>{EXAM_PURPOSE}</p>
              <dl className="guide-facts">
                {EXAM_FACTS.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.value}
                      {f.note && <span className="guide-muted"> ({f.note})</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <Sources list={[...new Map(EXAM_FACTS.flatMap((f) => f.sources).map((x) => [x.url, x])).values()]} />
            </div>
            <div className="guide-col">
              <h3 className="guide-h3 guide-h3--top">出題範囲と配点</h3>
              <ul className="guide-domains">
                {CURRICULUM.map((c) => (
                  <li key={c.domain}>
                    <span className="guide-domains__head">
                      <span>{c.domain}</span>
                      <span>{EXAM_WEIGHTS[c.domain]}%</span>
                    </span>
                    <span className="guide-bar" aria-hidden="true">
                      <span style={{ width: `${EXAM_WEIGHTS[c.domain]}%` }} />
                    </span>
                    <span className="guide-muted">
                      {c.competencies.map((x) => x.ja).join('・')} → {weeksLabel(WEEKS.filter((w) => w.domain === c.domain).map((w) => w.week))}
                    </span>
                  </li>
                ))}
              </ul>
              <Sources
                list={[
                  {
                    ...SOURCES.curriculum,
                    label: `${SOURCES.curriculum.label} (${CURRICULUM_VERSION})`,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <section id="exam-day" aria-labelledby="guide-day" className="guide-section">
          <p className="guide-kicker">KCNA-JP を受ける人へ</p>
          <h2 id="guide-day" className="guide-h2">
            申し込みから結果まで
          </h2>
          <p className="guide-muted">受験者ハンドブックなど、LF の公式の文書から書き写しました。変わることがあるので、申し込む前に出典を開いて確かめてください。</p>
          {EXAM_DAY.map((g) => (
            <div key={g.id} className="guide-day">
              <h3 className="guide-h3">{g.title}</h3>
              <ul className="guide-steps">
                {g.items.map((x) => (
                  <li key={x.text}>
                    {x.text}
                    <Sources list={x.sources} checked={EXAM_DAY_CHECKED_AT} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="guide-how" className="guide-section guide-section--wide">
          <div className="guide-cols">
            <div className="guide-col">
              <h2 id="guide-how" className="guide-h2">
                問題の作り方と出典
              </h2>
              <ol className="guide-steps">
                <li>
                  公開カリキュラムの細目を、{STATS.weeks} 週・{STATS.lessons - STATS.labs} レッスンに割る
                </li>
                <li>公式の文書を読んで問題を一から書き、各問に出典の URL を付ける</li>
                <li>書いた担当とは別の担当が、出典のページと 1 問ずつ照らして直す</li>
                <li>
                  公開後に誤りが見つかれば、
                  <Link href={NEW_ISSUE_URL} isExternalLink newTabLabel="(新しいタブで開きます)">
                    Issue
                  </Link>{' '}
                  で受けて直す
                </li>
              </ol>
              <p className="guide-note">
                実際の試験問題や、受験者の記憶から再現した問題は使っていません。試験の規約で、問題の公開・共有は禁じられています (<Ext s={SOURCES.agreement} />
                )。
              </p>
            </div>
            <div className="guide-col">
              <h3 className="guide-h3 guide-h3--top">
                主な情報源と出典の内訳 <span className="guide-muted">{STATS.questions} 問</span>
              </h3>
              <span className="guide-split" role="img" aria-label={sourceLabel}>
                {top.map((s, i) => (
                  <span key={s.host} className={`guide-split__${i}`} style={{ width: share(s.count) }} />
                ))}
                <span className="guide-split__rest" />
              </span>
              <ul className="guide-hosts">
                {STATS.sources.map((x) => {
                  const site = SOURCE_SITES[x.host];
                  return (
                    <li key={x.host}>
                      <span>
                        {site ? (
                          <Link href={site.url} isExternalLink newTabLabel="(新しいタブで開きます)">
                            {site.label}
                          </Link>
                        ) : (
                          x.host
                        )}
                      </span>
                      <span className="guide-muted">{x.count} 問</span>
                    </li>
                  );
                })}
              </ul>
              <h3 className="guide-h3">公式の学習素材</h3>
              <ul className="guide-hosts guide-hosts--one">
                {STUDY_MATERIALS.map((m) => (
                  <li key={m.url}>
                    <span>
                      <Ext s={m} />
                    </span>
                    <span className="guide-muted">{m.note}</span>
                  </li>
                ))}
              </ul>
              <p className="guide-muted">
                数は問題データから数えています。各問の解説の下にも出典があります。言葉の意味は <a href={glossaryHref}>用語集</a> で引けます。
              </p>
            </div>
          </div>
        </section>

        <p className="guide-foot guide-muted">
          The Linux Foundation・CNCF とは関係のない、個人の非公式サイトです。Kubernetes と KCNA は The Linux Foundation の商標です。{' '}
          <a href={aboutHref}>このサイトについて</a>
        </p>
      </div>
    </div>
  );
}

export default function Guide({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="guide" progress={progress} />}>
        <div className="desk">
          <Body />
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
      <main>
        <Body />
      </main>
      <BottomTabs current="guide" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
