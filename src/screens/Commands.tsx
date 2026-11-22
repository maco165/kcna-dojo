// コマンドのページ (/commands/ と /commands/<id>/)。問題に出てくるコマンドごとに、何をするか・書き方・オプション・
// 中で何が起きるか・API の要求・実行の例・-v で見える要求・実装の抜粋・出てくる問題・公式リファレンスを出す
import { useMemo } from 'react';
import Crumbs from '../components/Crumbs';
import { AppShell } from '@astryxdesign/core/AppShell';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { allQuestions } from '../content/lessons';
import { COMMAND_PAGES, TOOL_ORDER, findCommandPage, implUrl, type CommandPage } from '../content/commandPages';
import commands from '../content/commands.json';
import { commandUses, type CommandData } from '../lib/commandRefs';
import type { Progress } from '../lib/progress';
import { commandsHref, handbookHref, lessonHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

/** そのコマンドが出てくるレッスン (レッスンの id と題、出てくる問題の数) */
function lessonsOf(id: string) {
  const out = new Map<string, { title: string; week: number; count: number }>();
  for (const r of allQuestions()) {
    if (!commandUses(r.question, commands as CommandData).some((u) => u.entry.id === id)) continue;
    const had = out.get(r.lesson.id);
    out.set(r.lesson.id, { title: r.lesson.title, week: r.week, count: (had?.count ?? 0) + 1 });
  }
  return [...out].map(([lessonId, v]) => ({ lessonId, ...v }));
}

function Index() {
  const groups = TOOL_ORDER.map((tool) => ({ tool, pages: COMMAND_PAGES.filter((p) => p.tool === tool) })).filter((g) => g.pages.length > 0);
  return (
    <div className="hb cmdp">
      <div className="hb-head">
        <Crumbs items={[{ name: 'コマンド' }]} />
        <h1 className="week-title">コマンド</h1>
        <p className="hb-lead">
          問題に出てくるコマンドごとに、何をするか・書き方・オプションに加えて、打ってから結果が出るまでに中で何が起きるか (どの API の要求になり、どの部品が動くか) を、実際のコード (実行の例と出力・kubectl -v で見える要求・実装のソースの該当箇所) と一緒に説明します。中身は公式のリファレンスと実装で確かめ、出典を付けています。
        </p>
        <p className="hb-lead hb-muted">
          kubectl が API サーバーへ要求を送る流れの全体は、<a href={handbookHref('kubectl-internals')}>ハンドブックの「kubectl の中身」</a>にあります。
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.tool} className="hb-domain" aria-labelledby={`cmd-tool-${g.tool}`}>
          <h2 id={`cmd-tool-${g.tool}`} className="hb-domain__head">
            <span>{g.tool}</span>
            <span className="hb-muted">{g.pages.length} コマンド</span>
          </h2>
          <ul className="cmdp-list">
            {g.pages.map((p) => (
              <li key={p.id}>
                <a className="cmdp-row" href={commandsHref(p.id)}>
                  <code className="cmd-note__name">{p.command}</code>
                  <span>{p.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Page({ p }: { p: CommandPage }) {
  // 全問題を数えるので、ページが変わったときだけ数え直す
  const lessons = useMemo(() => lessonsOf(p.id), [p.id]);
  const flags = [...(p.flags ?? []), ...p.globalFlags];
  return (
    <article className="hb cmdp" aria-labelledby="cmdp-title">
      <Crumbs items={[{ name: 'コマンド', href: commandsHref() }, { name: p.tool }, { name: p.command }]} />
      <div className="hb-head">
        <h1 id="cmdp-title" className="week-title">
          <code className="cmdp-title">{p.command}</code>
        </h1>
        <p className="hb-lead">{p.summary}</p>
        {p.detail && <p className="hb-lead hb-muted">{p.detail}</p>}
      </div>

      <section className="cmp-section" aria-labelledby="cmdp-usage">
        <h2 id="cmdp-usage" className="hb-domain__head">
          書き方
        </h2>
        <CodeBlock code={p.usage} language="bash" width="100%" size="sm" hasCopyButton={false} />
        {flags.length > 0 && (
          <dl className="cmd-note__flags cmdp-flags">
            {flags.map((f) => (
              <div key={f.flags.join(',')}>
                <dt>
                  <code>{f.flags.join(', ')}</code>
                </dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="cmp-section" aria-labelledby="cmdp-inside">
        <h2 id="cmdp-inside" className="hb-domain__head">
          中で何が起きるか
        </h2>
        <ol className="cmdp-inside">
          {p.inside.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {p.api.length > 0 && (
          <div className="cmp-scroll" role="region" aria-label="送る API の要求" tabIndex={0}>
            <table className="cmp-table cmdp-api">
              <thead>
                <tr>
                  <th scope="col">メソッド</th>
                  <th scope="col">パス</th>
                  <th scope="col">いつ</th>
                </tr>
              </thead>
              <tbody>
                {p.api.map((a) => (
                  <tr key={`${a.method} ${a.path}`}>
                    <td>
                      <code>{a.method}</code>
                    </td>
                    <td>
                      <code>{a.path}</code>
                    </td>
                    <td>{a.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cmp-section" aria-labelledby="cmdp-examples">
        <h2 id="cmdp-examples" className="hb-domain__head">
          実行の例
        </h2>
        {p.examples.map((e) => (
          <div key={e.title} className="cmp-example">
            <Text weight="semibold">{e.title}</Text>
            <CodeBlock code={e.output ? `${e.code}\n${e.output}` : e.code} language="bash" width="100%" size="sm" hasCopyButton={false} />
            {e.note && <p className="cmdp-note">{e.note}</p>}
          </div>
        ))}
        {p.verbose && (
          <div className="cmp-example">
            <Text weight="semibold">-v で見える要求</Text>
            <CodeBlock code={`${p.verbose.code}\n${p.verbose.output}`} language="bash" width="100%" size="sm" hasCopyButton={false} />
            {p.verbose.note && <p className="cmdp-note">{p.verbose.note}</p>}
          </div>
        )}
      </section>

      {p.impl && (
        <section className="cmp-section" aria-labelledby="cmdp-impl">
          <h2 id="cmdp-impl" className="hb-domain__head">
            実装を読む
          </h2>
          <p className="cmdp-note">
            <Link href={implUrl(p.impl)} isExternalLink newTabLabel="(新しいタブで開きます)">
              {`${p.impl.repo} ${p.impl.ref} の ${p.impl.path}${p.impl.lines ? ` (${p.impl.lines})` : ''}`}
            </Link>
          </p>
          <CodeBlock code={p.impl.excerpt} language="go" width="100%" size="sm" hasCopyButton={false} />
          {p.impl.note && <p className="cmdp-note">{p.impl.note}</p>}
        </section>
      )}

      {lessons.length > 0 && (
        <section className="cmp-section" aria-labelledby="cmdp-lessons">
          <h2 id="cmdp-lessons" className="hb-domain__head">
            出てくるレッスン
          </h2>
          <ul className="gloss-chips">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <a className="gloss-chip" href={lessonHref(l.lessonId)}>{`第 ${l.week} 週 ${l.title} (${l.count} 問)`}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cmp-section" aria-labelledby="cmdp-sources">
        <h2 id="cmdp-sources" className="hb-domain__head">
          出典
        </h2>
        <ul className="hb-sources">
          {[{ label: `${p.command} の公式リファレンス`, url: p.source }, ...p.sources.filter((s) => s.url !== p.source)].map((s) => (
            <li key={s.url}>
              <Link href={s.url} isExternalLink newTabLabel="(新しいタブで開きます)">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="hb-muted">
        <a href={commandsHref()}>コマンドの一覧へ</a>
      </p>
    </article>
  );
}

function Body({ commandId }: { commandId?: string }) {
  if (!commandId) return <Index />;
  const p = findCommandPage(commandId);
  if (!p) {
    return (
      <div className="hb cmdp">
        <h1 className="week-title">見つかりませんでした</h1>
        <p>
          <a href={commandsHref()}>コマンドの一覧へ</a>
        </p>
      </div>
    );
  }
  return <Page p={p} />;
}

export default function Commands({ progress, commandId }: { progress: Progress; commandId?: string }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="commands" progress={progress} />}>
        <div className="desk">
          <Body commandId={commandId} />
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
        <Body commandId={commandId} />
      </main>
      <BottomTabs current="commands" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
