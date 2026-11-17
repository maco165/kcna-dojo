import { useMemo, useState } from 'react';
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
import { dueQuestions, findLesson } from '../content';
import glossary from '../content/glossary.json';
import type { Domain } from '../content/types';
import { searchTerms, sortTerms, termDomain, type GlossaryTerm } from '../lib/glossary';
import { DOMAINS } from '../lib/lessonStatus';
import type { Progress } from '../lib/progress';
import { lessonHref } from '../lib/route';
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

/** 説明・出てくるレッスン・出典 (開いた語の中身。スマホと PC で共通) */
function Detail({ t, large }: { t: Entry; large?: boolean }) {
  const lessons = t.lessons.map((id) => ({ id, found: findLesson(id) })).filter((l) => l.found);
  return (
    <div className="gloss-detail">
      <p className={large ? 'gloss-detail__desc gloss-detail__desc--lg' : 'gloss-detail__desc'}>{t.description}</p>
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
        <Link href={t.source} isExternalLink newTabLabel="(新しいタブで開きます)">
          {hostOf(t.source)}
        </Link>
      </Text>
    </div>
  );
}

function Filters({ value, onChange, counts }: { value: Domain | 'all'; onChange: (v: Domain | 'all') => void; counts: Map<Domain | 'all', number> }) {
  const items: [Domain | 'all', string][] = [['all', 'すべて'], ...ORDER.map((d) => [d, SHORT[d]] as [Domain, string])];
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
function PhoneList({ hits }: { hits: Entry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="gloss-rows">
      {hits.map((t) => {
        const isOpen = open === t.id;
        return (
          <li key={t.id} className="gloss-row">
            <button type="button" className="gloss-row__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.id)}>
              <span className="gloss-row__text">
                <span className="gloss-row__name">
                  <span className="gloss-row__term">{t.term}</span>
                  {t.aliases?.[0] && <span className="gloss-row__alias">{t.aliases[0]}</span>}
                </span>
                {!isOpen && <span className="gloss-row__gist">{t.description}</span>}
              </span>
              <ChevronDownIcon width={18} height={18} aria-hidden="true" className={isOpen ? 'gloss-row__chev gloss-row__chev--open' : 'gloss-row__chev'} />
            </button>
            {isOpen && (
              <div className="gloss-row__body">
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
function DeskList({ hits }: { hits: Entry[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = hits.find((t) => t.id === picked) ?? hits[0];
  const groups: { d: string; items: Entry[] }[] = ORDER.map((d) => ({ d: d as string, items: hits.filter((t) => t.domain === d) })).filter((g) => g.items.length > 0);
  const other = hits.filter((t) => !t.domain);
  if (other.length) groups.push({ d: 'その他', items: other });
  return (
    <div className="gloss-desk">
      <nav aria-label="用語の一覧" className="gloss-index">
        {groups.map((g) => (
          <section key={g.d}>
            <h2 className="gloss-index__head">
              {g.d} · {g.items.length}
            </h2>
            <ul className="gloss-index__list">
              {g.items.map((t) => (
                <li key={t.id}>
                  <button type="button" className="gloss-index__item" aria-current={current?.id === t.id ? 'true' : undefined} onClick={() => setPicked(t.id)}>
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
        <article className="gloss-pane" aria-live="polite">
          <div>
            {current.domain && <Text type="supporting">{current.domain}</Text>}
            <h2 className="gloss-pane__term">{current.term}</h2>
            {current.aliases && current.aliases.length > 0 && <Text type="supporting">{current.aliases.join(' · ')}</Text>}
          </div>
          <Detail t={current} large />
        </article>
      )}
    </div>
  );
}

function Body({ isWide }: { isWide: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Domain | 'all'>('all');
  const found = useMemo(() => searchTerms(TERMS, query), [query]);
  const hits = filter === 'all' ? found : found.filter((t) => t.domain === filter);
  const counts = new Map<Domain | 'all', number>([['all', found.length], ...ORDER.map((d) => [d, found.filter((t) => t.domain === d).length] as [Domain, number])]);
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="supporting">{SITE_NAME}</Text>
        <h1 className="week-title">用語集</h1>
        <Text type="supporting">問題に出る {TERMS.length} 語の短い説明です。詳しくは出典 (公式の文書) を見てください。</Text>
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
        <DeskList hits={hits} />
      ) : (
        <PhoneList hits={hits} />
      )}
    </VStack>
  );
}

export default function Glossary({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="glossary" progress={progress} />}>
        <div className="desk">
          <div className="gloss-page">
            <Body isWide />
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
        <Body isWide={false} />
      </main>
      <BottomTabs current="glossary" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}
