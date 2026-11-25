// 実践の章 (/hands-on/<id>/)。手順ごとに、なぜ・コマンド・1 行ずつの意味・実機の出力・読み方・つまずいた時・出典を出し、
// 印を全部付けると完了にできる。印は章の途中で閉じても残る (kcna.v1 の handsOn)。OS ごとの手順は、選んだ OS の分だけ出す
import { useState, type ReactNode } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Link } from '@astryxdesign/core/Link';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import { AskAiLinks } from '../components/AskAi';
import BottomTabs from '../components/BottomTabs';
import Crumbs from '../components/Crumbs';
import HandsOnLines from '../components/HandsOnLines';
import LazyCodeBlock from '../components/LazyCodeBlock';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { MEANINGS, Prose, TERM_NAMES } from '../components/TermProse';
import TermTipArea from '../components/TermTip';
import { dueReviewCount } from '../content';
import { HANDS_ON_TITLE, chapterNo } from '../content/handsOn';
import { HANDS_ON_CHAPTERS } from '../content/handsOnChapters';
import type { HandsOnChapter as Chapter, HandsOnOs, HandsOnStep } from '../content/types';
import { handsOnStepText } from '../lib/askAi';
import { XP_PER_LAB } from '../lib/grade';
import { OS_CHOICES, OS_LABEL, WHERE_LABEL, handsOnOs, markedCount, stepsFor } from '../lib/handsOn';
import { completeHandsOn, goalXp, markHandsOnStep, restartHandsOn, setProfile, todayXp, type Progress } from '../lib/progress';
import { handbookHref, handsOnHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { makeTermLinker, type TermPiece } from '../lib/termLinks';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Update = (fn: (p: Progress) => Progress) => void;

/** 開いたときだけ中身を描く折りたたみ (AI のボタンは手順の数だけあるため) */
function OnOpen({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="ho-more" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{summary}</summary>
      {open && children}
    </details>
  );
}

function Source({ url }: { url: string }) {
  return (
    <Link href={url} isExternalLink newTabLabel="(新しいタブで開きます)">
      {new URL(url).hostname}
    </Link>
  );
}

/** 1 手順の中身。ask があれば、AI に聞く折りたたみを付ける */
function StepBody({ step, text, why, ask }: { step: HandsOnStep; text: TermPiece[]; why: TermPiece[]; ask?: string }) {
  const tags = [step.os && `${OS_LABEL[step.os]} の手順`, step.where && WHERE_LABEL[step.where]].filter(Boolean);
  return (
    <>
      {tags.length > 0 && <p className="ho-tags">{tags.map((t) => <span key={t} className="hb-scope">{t}</span>)}</p>}
      <p className="hb-step__text">
        <Prose pieces={text} />
      </p>
      <p className="ho-note">
        <b>なぜ</b>
        <Prose pieces={why} />
      </p>
      {step.unverified && (
        <p className="ho-note">
          <b>実機で未確認</b>
          {step.unverified}
        </p>
      )}
      {step.code && <LazyCodeBlock code={step.code.text} language={step.code.language === 'text' ? 'plaintext' : step.code.language} title={step.code.title} hasCopyButton />}
      {step.code && step.lines && <HandsOnLines language={step.code.language} lines={step.lines} />}
      {step.output && (
        <figure className="hb-output">
          <figcaption>実機の出力 (名前・時刻などは環境で変わります)</figcaption>
          <pre tabIndex={0}>{step.output}</pre>
        </figure>
      )}
      {step.read && (
        <p className="ho-note">
          <b>出力の読み方</b>
          {step.read}
        </p>
      )}
      {step.trouble && step.trouble.length > 0 && (
        <details className="ho-more">
          <summary>つまずいた時 ({step.trouble.length})</summary>
          {step.trouble.map((t) => (
            <dl key={t.symptom} className="ho-trouble">
              <dt>症状</dt>
              <dd>{t.symptom}</dd>
              <dt>確かめ方</dt>
              <dd>{t.check}</dd>
              <dt>直し方</dt>
              <dd>{t.fix}</dd>
            </dl>
          ))}
        </details>
      )}
      {ask && (
        <OnOpen summary="AI に聞く (使わなくても進められます)">
          <AskAiLinks text={ask} lead="この手順を AI に聞く" />
        </OnOpen>
      )}
      {step.source && (
        <p className="hb-muted">
          出典: <Source url={step.source} />
        </p>
      )}
    </>
  );
}

export function ChapterView({ chapter: c, chapters, progress, updateProgress }: { chapter: Chapter; chapters: Chapter[]; progress: Progress; updateProgress: Update }) {
  const os = handsOnOs(progress);
  const rec = progress.handsOn?.[c.id];
  const steps = stepsFor(c.steps, os);
  const cleanup = stepsFor(c.cleanup, os);
  const hasOs = [...c.steps, ...c.cleanup].some((s) => s.os);
  const { marked, total } = markedCount(c, rec, os);
  const finished = rec?.done === true && !rec.redo;
  // 本文の順に、語ごとに最初の 1 回だけリンクにする
  const link = makeTermLinker(TERM_NAMES);
  const summary = link(c.summary);
  const prose = (s: HandsOnStep) => ({ step: s, text: link(s.text), why: link(s.why) });
  const stepProse = steps.map(prose);
  const cleanupProse = cleanup.map(prose);
  const at = chapters.findIndex((x) => x.id === c.id);
  const prev = chapters[at - 1];
  const next = chapters[at + 1];
  const now = new Date();

  return (
    <TermTipArea key={c.id} meanings={MEANINGS} className="hb" aria-labelledby="hb-title">
      <Crumbs items={[{ name: HANDS_ON_TITLE, href: handsOnHref() }, { name: c.title }]} />
      <div className="hb-head">
        <span className="hb-muted">{`${chapterNo(c)} · 約 ${c.minutes} 分 · ${total} 手順`}</span>
        <h1 id="hb-title" className="week-title">
          {c.title}
        </h1>
        <p className="hb-lead">
          <Prose pieces={summary} />
        </p>
      </div>

      <section className="lab-prep ho-prep" aria-labelledby="ho-prep">
        <h2 id="ho-prep" className="h-sm">
          始める前に
        </h2>
        <dl className="lab-prep__list">
          <dt>この章でできるようになること</dt>
          <dd>{c.goal}</dd>
          <dt>この章で分かる特徴</dt>
          <dd>
            <ul>
              {c.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </dd>
          <dt>用意するもの</dt>
          <dd>
            <ul>
              {c.needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </dd>
          {c.reads.length > 0 && (
            <>
              <dt>先に読む</dt>
              <dd className="lab-prep__chips">
                {c.reads.map((r) => (
                  <a key={r.topic} className="gloss-chip" href={handbookHref(r.topic)}>
                    {r.label}
                  </a>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="ho-steps" className="hb-section">
        <h2 id="ho-steps" className="hb-h2">
          手順
        </h2>
        <p className="hb-muted">上から順に 1 つずつ動かし、書いてあるとおりになったら印を付けます。印はこのブラウザに残り、途中で閉じても続きから始められます。</p>
        {hasOs && (
          <div className="ho-os">
            <Text type="supporting">使っている PC</Text>
            <SegmentedControl label="使っている PC" value={os} onChange={(v) => updateProgress((p) => setProfile(p, { os: v as HandsOnOs }))}>
              {OS_CHOICES.map((o) => (
                <SegmentedControlItem key={o} value={o} label={OS_LABEL[o]} />
              ))}
            </SegmentedControl>
          </div>
        )}
        <ol className="hb-flow ho-steps">
          {stepProse.map(({ step, text, why }, i) => (
            <li key={step.id} id={`step-${step.id}`}>
              <div className="hb-step">
                <StepBody step={step} text={text} why={why} ask={handsOnStepText(c.title, step, i, OS_LABEL[os])} />
                <CheckboxInput label={`手順 ${i + 1} を確かめた`} value={rec?.steps.includes(step.id) === true} onChange={(on) => updateProgress((p) => markHandsOnStep(p, c.id, step.id, on, new Date()))} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ho-done" className="hb-section hb-done">
        <h2 id="ho-done" className="hb-h2">
          完了
        </h2>
        <HStack gap={3} vAlign="center" wrap="wrap">
          {finished && <StatusDot variant="success" label="完了" />}
          <Text type={finished ? undefined : 'supporting'} aria-live="polite">
            {finished ? `完了しました · 今日 ${todayXp(progress, now)} / ${goalXp(progress)} XP` : `印 ${marked} / ${total} 手順`}
          </Text>
          <Button
            variant={finished ? 'secondary' : 'primary'}
            label={finished ? '印を消してもう一度やる' : `完了にする (+${XP_PER_LAB} XP)`}
            isDisabled={!finished && marked < total}
            onClick={() => updateProgress((p) => (finished ? restartHandsOn(p, c.id, new Date()) : completeHandsOn(p, c.id, XP_PER_LAB, new Date())))}
          />
        </HStack>
      </section>

      <section aria-labelledby="ho-challenges" className="hb-section">
        <h2 id="ho-challenges" className="hb-h2">
          課題
        </h2>
        <p className="hb-muted">手順を見ずに、自分で考えて動かしてみます。完了の条件には入れません。</p>
        <ol className="hb-flow">
          {c.challenges.map((x) => (
            <li key={x.task}>
              <div className="hb-step">
                <p className="hb-step__text">{x.task}</p>
                <details className="ho-more">
                  <summary>ヒント</summary>
                  <p>{x.hint}</p>
                </details>
                <details className="ho-more">
                  <summary>答え</summary>
                  <p className="ho-answer">{x.answer}</p>
                </details>
                <p className="ho-note">
                  <b>確かめ方</b>
                  {x.verify}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ho-cleanup" className="hb-section">
        <h2 id="ho-cleanup" className="hb-h2">
          後片付け
        </h2>
        <p className="hb-muted">終わったら片付けます。完了の条件には入れません。</p>
        <ol className="hb-flow">
          {cleanupProse.map(({ step, text, why }) => (
            <li key={step.id}>
              <div className="hb-step">
                <StepBody step={step} text={text} why={why} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ho-src" className="hb-section">
        <h2 id="ho-src" className="hb-h2">
          出典
        </h2>
        <ul className="hb-sources">
          {c.sources.map((s) => (
            <li key={s.url}>
              <Link href={s.url} isExternalLink newTabLabel="(新しいタブで開きます)">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="前後の章" className="hb-pager">
        <a href={prev ? handsOnHref(prev.id) : handsOnHref()}>
          <span className="hb-muted">{prev ? '前の章' : '戻る'}</span>
          {prev ? prev.title : '実践の一覧'}
        </a>
        {next && (
          <a href={handsOnHref(next.id)} className="hb-pager__next">
            <span className="hb-muted">次の章</span>
            {next.title}
          </a>
        )}
      </nav>
    </TermTipArea>
  );
}

export default function HandsOnChapter({ chapterId, progress, updateProgress }: { chapterId: string; progress: Progress; updateProgress: Update }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  const chapter = HANDS_ON_CHAPTERS.find((c) => c.id === chapterId);
  const body = chapter ? (
    <ChapterView chapter={chapter} chapters={HANDS_ON_CHAPTERS} progress={progress} updateProgress={updateProgress} />
  ) : (
    <div className="hb">
      <h1 className="week-title">見つかりませんでした</h1>
      <p>
        <a href={handsOnHref()}>実践の一覧へ</a>
      </p>
    </div>
  );
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="handsOn" progress={progress} />}>
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
      <BottomTabs current="handsOn" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
