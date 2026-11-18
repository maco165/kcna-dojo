import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount, findLesson } from '../content';
import glossary from '../content/glossary.json';
import type { Domain } from '../content/types';
import { isFreshVisit } from '../lib/scrollMemory';
import { searchTerms, sortTerms, termDomain, termQuestion, type GlossaryTerm } from '../lib/glossary';
import { AskAiLinks } from '../components/AskAi';
import Diagram from '../components/Diagram';
import { figureOf } from '../content/glossaryFigures';
import { findTopic } from '../content/handbook';
import { DOMAINS } from '../lib/lessonStatus';
import type { Progress } from '../lib/progress';
import { glossaryTermHref, handbookHref, lessonHref } from '../lib/route';
import { linkDetail, termNames } from '../lib/termLinks';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Entry = GlossaryTerm & { domain?: Domain };

const ORDER = DOMAINS.map((d) => d.name);
const TERMS: Entry[] = sortTerms((glossary as { terms: GlossaryTerm[] }).terms).map((t) => ({
  ...t,
  domain: termDomain(t, (id) => findLesson(id)?.lesson.domain, ORDER),
}));
/** 絞り込みの札の短い名前 */
const SHORT: Record<Domain, string> = {
  'Kubernetes Fundamentals': '基礎',
  'Container Orchestration': 'オーケストレーション',
  'Cloud Native Application Delivery': '届け方',
  'Cloud Native Architecture': '設計',
};

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const NAMES = termNames(TERMS);

/** 説明・詳しい説明・出てくるレッスンとハンドブック・出典・AI に聞く (開いた語の中身。スマホと PC で共通) */
function Detail({ t, large }: { t: Entry; large?: boolean }) {
  const lessons = t.lessons.map((id) => ({ id, found: findLesson(id) })).filter((l) => l.found);
  const topics = (t.topics ?? []).map((id) => findTopic(id)?.topic).filter((x) => x !== undefined);
  const sources = [{ label: hostOf(t.source), url: t.source }, ...(t.sources ?? []).filter((x) => x.url !== t.source)];
  const figure = figureOf(t.id);
  return (
    <div className="gloss-detail">
      <p className={large ? 'gloss-detail__desc gloss-detail__desc--lg' : 'gloss-detail__desc'}>{t.description}</p>
      {linkDetail(NAMES, t).map((pieces, i) => (
        <p key={i} className="gloss-detail__more">
          {pieces.map((p, j) =>
            typeof p === 'string' ? (
              p
            ) : (
              <a key={j} className="gloss-term" href={glossaryTermHref(p.id)}>
                {p.text}
              </a>
            ),
          )}
        </p>
      ))}
      {/* 図は図の幅まで (小さい図を引き伸ばさない)。図のデータの width は 640 以下で、欄の幅に収まる */}
      {figure && (
        <div className="gloss-detail__figure" style={{ maxWidth: figure.spec.width }}>
          <Diagram spec={figure.spec} id={`gloss-${figure.id}`} highlight={t.id} />
        </div>
      )}
      {topics.length > 0 && (
        <VStack gap={1.5}>
          <h3 className="gloss-detail__label">ハンドブックで読む</h3>
          <ul className="gloss-chips">
            {topics.map((topic) => (
              <li key={topic!.id}>
                <a className="gloss-chip" href={handbookHref(topic!.id)}>
                  {topic!.title}
                </a>
              </li>
            ))}
          </ul>
        </VStack>
      )}
      {lessons.length > 0 && (
        <VStack gap={1.5}>
          <h3 className="gloss-detail__label">出てくるレッスン</h3>
          <ul className="gloss-chips">
            {lessons.map(({ id, found }) => (
              <li key={id}>
                <a className="gloss-chip" href={lessonHref(id)}>{`第 ${found!.week} 週 ${found!.lesson.title}`}</a>
              </li>
            ))}
          </ul>
        </VStack>
      )}
      <Text type="supporting">
        出典:{' '}
        {sources.map((x, i) => (
          <Fragment key={x.url}>
            {i > 0 && '・'}
            <Link href={x.url} isExternalLink newTabLabel="(新しいタブで開きます)">
              {x.label}
            </Link>
          </Fragment>
        ))}
      </Text>
      <AskAiLinks text={termQuestion(t)} lead="まだ分からなければ AI に聞く" />
    </div>
  );
}

/** 絞り込みの値。out は試験の範囲の外の語 (レッスンに出ず、ハンドブックの範囲外で説明している) */
type Filter = Domain | 'all' | 'out';

function Filters({ value, onChange, counts }: { value: Filter; onChange: (v: Filter) => void; counts: Map<Filter, number> }) {
  const items: [Filter, string][] = [['all', 'すべて'], ...ORDER.map((d) => [d, SHORT[d]] as [Domain, string]), ['out', '範囲外']];
  return (
    <div role="group" aria-label="分野で絞る" className="gloss-filters">
      {items.map(([k, label]) => (
        <button key={k} type="button" className="gloss-filter" aria-pressed={value === k} onClick={() => onChange(k)}>
          {label} <span className="gloss-filter__count">{counts.get(k) ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/** スマホ: 語と説明の 1 行目だけの閉じた一覧。押すと開く */
function PhoneList({ hits, initial }: { hits: Entry[]; initial?: string }) {
  const [open, setOpen] = useState<string | null>(initial ?? null);
  // ほかのページの用語のリンクから来たときは、その語を開いて見える所へ送る
  useEffect(() => {
    // 経路が変わったときの「先頭へ戻す」(lib/scrollMemory) のあとに送る
    // 戻る・進むで来たときは、覚えた位置に戻すほうを優先する (送り直さない)
    if (initial) requestAnimationFrame(() => requestAnimationFrame(() => isFreshVisit() && document.getElementById(`gloss-row-${initial}`)?.scrollIntoView({ block: 'start' })));
  }, [initial]);
  // 検索や絞り込みで消えた語は閉じたことにする (戻したときに勝手に開かない)
  useEffect(() => {
    if (open && !hits.some((t) => t.id === open)) setOpen(null);
  }, [hits, open]);
  return (
    <ul className="gloss-rows">
      {hits.map((t) => {
        const isOpen = open === t.id;
        return (
          <li key={t.id} className="gloss-row" id={`gloss-row-${t.id}`}>
            <h2 className="gloss-row__h">
            <button type="button" className="gloss-row__head" aria-expanded={isOpen} aria-controls={`gloss-body-${t.id}`} onClick={() => setOpen(isOpen ? null : t.id)}>
              <span className="gloss-row__text">
                <span className="gloss-row__name">
                  <span className="gloss-row__term">{t.term}</span>
                  {t.aliases?.[0] && <span className="gloss-row__alias">{t.aliases[0]}</span>}
                </span>
                {!isOpen && (
                  <span className="gloss-row__gist" aria-hidden="true">
                    {t.description}
                  </span>
                )}
              </span>
              <ChevronDownIcon width={18} height={18} aria-hidden="true" className={isOpen ? 'gloss-row__chev gloss-row__chev--open' : 'gloss-row__chev'} />
            </button>
            </h2>
            {isOpen && (
              <div className="gloss-row__body" id={`gloss-body-${t.id}`}>
                {t.aliases && t.aliases.length > 1 && <Text type="supporting">{t.aliases.join(' · ')}</Text>}
                <Detail t={t} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** PC: 左に分野ごとの語の一覧、右に選んだ語の説明 */
function DeskList({ hits, initial }: { hits: Entry[]; initial?: string }) {
  const [picked, setPicked] = useState<string | null>(initial ?? null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // ほかのページの用語のリンクから来たときは、一覧のその語を見える所へ送る
  useEffect(() => {
    if (initial) buttons.current.get(initial)?.scrollIntoView({ block: 'nearest' });
  }, [initial]);
  // 検索や絞り込みで消えた語の選択は外す (戻したときに勝手に戻らない)
  useEffect(() => {
    if (picked && !hits.some((t) => t.id === picked)) setPicked(null);
  }, [hits, picked]);
  const current = hits.find((t) => t.id === picked) ?? hits[0];
  const groups: { d: string; items: Entry[] }[] = ORDER.map((d) => ({ d: d as string, items: hits.filter((t) => t.domain === d) })).filter((g) => g.items.length > 0);
  const other = hits.filter((t) => !t.domain);
  // 出てくるレッスンが無いのは、試験の範囲の外の語 (ハンドブックの範囲外の付録で説明している)
  if (other.length) groups.push({ d: '範囲外', items: other });
  // 一覧はロービングタブインデックス: Tab で入るのは今の語だけ、上下の矢印・Home・End で移る
  const ordered = groups.flatMap((g) => g.items);
  const move = (e: React.KeyboardEvent, from: string) => {
    const i = ordered.findIndex((t) => t.id === from);
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ordered.length - 1 : null;
    if (to === null || to < 0 || to >= ordered.length) return;
    e.preventDefault();
    setPicked(ordered[to].id);
    buttons.current.get(ordered[to].id)?.focus();
  };
  return (
    <div className="gloss-desk">
      <nav aria-label="用語の一覧 (上下の矢印で移る)" className="gloss-index">
        {groups.map((g) => (
          <section key={g.d}>
            <h2 className="gloss-index__head">
              {g.d} · {g.items.length}
            </h2>
            <ul className="gloss-index__list">
              {g.items.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="gloss-index__item"
                    ref={(el) => {
                      if (el) buttons.current.set(t.id, el);
                      else buttons.current.delete(t.id);
                    }}
                    tabIndex={current?.id === t.id ? 0 : -1}
                    aria-current={current?.id === t.id ? 'true' : undefined}
                    aria-controls="gloss-pane"
                    onClick={() => setPicked(t.id)}
                    onKeyDown={(e) => move(e, t.id)}
                  >
                    <span className="gloss-index__term">{t.term}</span>
                    {t.aliases?.[0] && <span className="gloss-index__alias">{t.aliases[0]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      {current && (
        <article className="gloss-pane" id="gloss-pane" aria-labelledby="gloss-pane-term">
          <div>
            {current.domain && <Text type="supporting">{current.domain}</Text>}
            <h2 className="gloss-pane__term" id="gloss-pane-term">
              {current.term}
            </h2>
            {current.aliases && current.aliases.length > 0 && <Text type="supporting">{current.aliases.join(' · ')}</Text>}
          </div>
          <Detail t={current} large />
        </article>
      )}
    </div>
  );
}

function Body({ isWide, termId }: { isWide: boolean; termId?: string }) {
  // リンクから来た語は、最初に一覧を出すときだけ開く (検索で一覧が出し直されても、もう一度は開かない)
  const pending = useRef(termId && TERMS.some((t) => t.id === termId) ? termId : undefined);
  useEffect(() => {
    pending.current = undefined;
  }, []);
  const initial = pending.current;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const found = useMemo(() => searchTerms(TERMS, query), [query]);
  const hits = filter === 'all' ? found : filter === 'out' ? found.filter((t) => !t.domain) : found.filter((t) => t.domain === filter);
  const counts = new Map<Filter, number>([['all', found.length], ...ORDER.map((d) => [d, found.filter((t) => t.domain === d).length] as [Domain, number]), ['out', found.filter((t) => !t.domain).length]]);
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">用語集</h1>
        <Text type="supporting">問題とハンドブックに出る {TERMS.length} 語の説明です。ハンドブックで分からない語を調べ、それでも分からなければ AI に聞けます。</Text>
      </VStack>
      <TextInput
        type="search"
        label="用語を探す"
        isLabelHidden
        placeholder="用語・別名・説明から探す (例: Pod, 永続)"
        startIcon={MagnifyingGlassIcon}
        value={query}
        onChange={setQuery}
        hasClear
        autoCapitalize="off"
        hasAutoCorrect={false}
        width="100%"
      />
      <Filters value={filter} onChange={setFilter} counts={counts} />
      <Text type="supporting" aria-live="polite">
        {query.trim() ? `${hits.length} 語が見つかりました` : `${hits.length} 語`}
      </Text>
      {hits.length === 0 ? (
        <Text type="supporting">見つかりませんでした。別の言い方 (英語・略語) でも探せます。</Text>
      ) : isWide ? (
        <DeskList hits={hits} initial={initial} />
      ) : (
        <PhoneList hits={hits} initial={initial} />
      )}
    </VStack>
  );
}

export default function Glossary({ progress, termId }: { progress: Progress; termId?: string }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="glossary" progress={progress} />}>
        <div className="desk">
          <div className="gloss-page">
            <Body isWide termId={termId} />
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
        <Body isWide={false} termId={termId} />
      </main>
      <BottomTabs current="glossary" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
