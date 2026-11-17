import { useMemo, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueQuestions, findLesson } from '../content';
import glossary from '../content/glossary.json';
import { searchTerms, sortTerms, type GlossaryTerm } from '../lib/glossary';
import type { Progress } from '../lib/progress';
import { lessonHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const TERMS = sortTerms((glossary as { terms: GlossaryTerm[] }).terms);
/** 初めに見せるレッスンの数。多い語は「すべて」で開く */
const LESSONS_SHOWN = 4;

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Entry({ t }: { t: GlossaryTerm }) {
  const [open, setOpen] = useState(false);
  const lessons = t.lessons.map((id) => ({ id, found: findLesson(id) })).filter((l) => l.found);
  const shown = open ? lessons : lessons.slice(0, LESSONS_SHOWN);
  return (
    <article className="gloss" id={`term-${t.id}`}>
      <VStack gap={2}>
        <VStack gap={0.5}>
          <h2 className="h-sm">{t.term}</h2>
          {t.aliases && t.aliases.length > 0 && <Text type="supporting">{t.aliases.join(' · ')}</Text>}
        </VStack>
        <Text>{t.description}</Text>
        <HStack gap={1} vAlign="center">
          <Text type="supporting">出典:</Text>
          <Link href={t.source} target="_blank" rel="noopener noreferrer">
            {hostOf(t.source)}
          </Link>
          <ArrowTopRightOnSquareIcon width={14} height={14} aria-hidden="true" />
        </HStack>
        {lessons.length > 0 && (
          <VStack gap={1}>
            <Text type="supporting">出てくるレッスン ({lessons.length})</Text>
            <ul className="gloss__lessons">
              {shown.map(({ id, found }) => (
                <li key={id}>
                  <Link href={lessonHref(id)}>{`第 ${found!.week} 週 ${found!.lesson.title}`}</Link>
                </li>
              ))}
            </ul>
            {lessons.length > LESSONS_SHOWN && (
              <div>
                <Button size="sm" variant="ghost" label={open ? '閉じる' : `すべて表示 (${lessons.length})`} onClick={() => setOpen((v) => !v)} />
              </div>
            )}
          </VStack>
        )}
      </VStack>
    </article>
  );
}

function Body() {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchTerms(TERMS, query), [query]);
  return (
    <VStack gap={5}>
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
      <Text type="supporting" aria-live="polite">
        {query.trim() ? `${hits.length} 語が見つかりました` : `${TERMS.length} 語`}
      </Text>
      <div className="gloss-list">
        {hits.map((t) => (
          <Entry key={t.id} t={t} />
        ))}
      </div>
      {hits.length === 0 && <Text type="supporting">見つかりませんでした。別の言い方 (英語・略語) でも探せます。</Text>}
    </VStack>
  );
}

export default function Glossary({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="glossary" progress={progress} />}>
        <div className="desk">
          <div className="about">
            <Body />
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
        <Body />
      </main>
      <BottomTabs current="glossary" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}
