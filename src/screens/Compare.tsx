// 似た語の比較表 (/compare/ と /compare/<id>/)。試験で取り違えやすい語の組ごとに、観点を並べた表・取り違えやすい点・違いが見えるコード・出典を出す。
// 中身の正本は src/content/compare.json (公式の文書で確かめて書く)
import { AppShell } from '@astryxdesign/core/AppShell';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { COMPARE_TABLES, findTable, type CompareTable } from '../content/compare';
import { compareHref, glossaryHref, glossaryTermHref, handbookHref } from '../lib/route';
import type { Progress } from '../lib/progress';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

function Index() {
  return (
    <div className="hb cmp">
      <div className="hb-head">
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">似た語の比較表</h1>
        <p className="hb-lead">
          試験で取り違えやすい語の組ごとに、何をするか・いつ使うか・どこが違うかを 1 つの表に並べました。表の下に、取り違えやすい点と、違いが見えるマニフェストやコマンドを添えています。中身は公式の文書 (kubernetes.io の英語版の最新など) で確かめ、出典を付けています。
        </p>
        <p className="hb-lead hb-muted">
          1 語ずつの説明は <a href={glossaryHref}>用語集</a>、仕組みの流れは <a href={handbookHref()}>ハンドブック</a> にあります。
        </p>
      </div>
      <ul className="cmp-list">
        {COMPARE_TABLES.map((t) => (
          <li key={t.id}>
            <a className="cmp-card" href={compareHref(t.id)}>
              <span className="cmp-card__title">{t.title}</span>
              <span className="cmp-card__cols">{t.columns.map((c) => c.name).join(' · ')}</span>
              <span className="cmp-card__lead">{t.lead}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Table({ t }: { t: CompareTable }) {
  return (
    <article className="hb cmp" aria-labelledby="cmp-title">
      <nav aria-label="パンくず" className="hb-crumbs">
        <ol>
          <li>
            <a href={compareHref()}>似た語の比較表</a>
          </li>
          <li aria-current="page">{t.title}</li>
        </ol>
      </nav>
      <div className="hb-head">
        <h1 id="cmp-title" className="week-title">
          {t.title}
        </h1>
        <p className="hb-lead">{t.lead}</p>
      </div>
      {/* 列が多い表はスマホで横に送る。1 列目 (観点) は送っても残す */}
      <div className="cmp-scroll" role="region" aria-label={`${t.title}の表`} tabIndex={0}>
        <table className="cmp-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">観点</span>
              </th>
              {t.columns.map((c) => (
                <th key={c.name} scope="col">
                  {c.term ? <a href={glossaryTermHref(c.term)}>{c.name}</a> : c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="cmp-section" aria-labelledby="cmp-pitfalls">
        <h2 id="cmp-pitfalls" className="hb-domain__head">
          取り違えやすい点
        </h2>
        <ul className="cmp-pitfalls">
          {t.pitfalls.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <section className="cmp-section" aria-labelledby="cmp-example">
        <h2 id="cmp-example" className="hb-domain__head">
          違いが見えるコード
        </h2>
        {t.example.map((e) => (
          <div key={e.title} className="cmp-example">
            <Text weight="semibold">{e.title}</Text>
            <CodeBlock code={e.code} language={e.language} width="100%" size="sm" hasCopyButton />
          </div>
        ))}
      </section>
      <section className="cmp-section" aria-labelledby="cmp-sources">
        <h2 id="cmp-sources" className="hb-domain__head">
          出典
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
      <p className="hb-muted">
        <a href={compareHref()}>比較表の一覧へ</a>
      </p>
    </article>
  );
}

function Body({ tableId }: { tableId?: string }) {
  if (!tableId) return <Index />;
  const t = findTable(tableId);
  if (!t) {
    return (
      <div className="hb cmp">
        <h1 className="week-title">見つかりませんでした</h1>
        <p>
          <a href={compareHref()}>比較表の一覧へ</a>
        </p>
      </div>
    );
  }
  return <Table t={t} />;
}

export default function Compare({ progress, tableId }: { progress: Progress; tableId?: string }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="compare" progress={progress} />}>
        <div className="desk">
          <Body tableId={tableId} />
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
        <Body tableId={tableId} />
      </main>
      <BottomTabs current="compare" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
