// 実践の一覧 (/hands-on/)。章 (src/content/hands-on/) と、問題演習の週に合わせた旧い実習を並べ、別々に完了の数を出す
import { AppShell } from '@astryxdesign/core/AppShell';
import { Text } from '@astryxdesign/core/Text';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import Crumbs from '../components/Crumbs';
import RepoLink from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { dueReviewCount } from '../content';
import { chapterNo, listedLabs } from '../content/coveredLabs';
import { WEEKS } from '../content/curriculum';
import { CHAPTERS_LEAD, HANDS_ON, HANDS_ON_LEAD, HANDS_ON_TITLE, HANDS_ON_WHO, LABS_LEAD, NO_CHAPTERS } from '../content/handsOn';
import type { HandsOnMeta } from '../content/types';
import { chapterStatus, doneChapters, handsOnOs } from '../lib/handsOn';
import { doneLessons } from '../lib/lessonStatus';
import type { Progress } from '../lib/progress';
import { handsOnHref, lessonHref, weekHref } from '../lib/route';
import { SITE_NAME } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

const LABS = listedLabs(WEEKS);

function Card({ href, kicker, title, lead, done, status }: { href: string; kicker: string; title: string; lead: string; done: boolean; status: string }) {
  return (
    <li>
      <a className="cmp-card" href={href}>
        <span className="cmp-card__cols">{kicker}</span>
        <span className="cmp-card__title">{title}</span>
        <span className="cmp-card__lead">{lead}</span>
        <span className={done ? 'hb-topic__read hb-topic__read--done' : 'hb-topic__read'}>{status}</span>
      </a>
    </li>
  );
}

export function HandsOnIndex({ progress, chapters = HANDS_ON }: { progress: Progress; chapters?: HandsOnMeta[] }) {
  const os = handsOnOs(progress);
  return (
    <div className="hb cmp">
      <div className="hb-head">
        <Crumbs items={[{ name: HANDS_ON_TITLE }]} />
        <h1 className="week-title">{HANDS_ON_TITLE}</h1>
        <p className="hb-lead">{HANDS_ON_LEAD}</p>
        <p className="hb-lead">
          {HANDS_ON_WHO} <a href={weekHref(1)}>問題演習へ</a>
        </p>
      </div>
      <section className="hb-section" aria-labelledby="ho-chapters">
        <h2 id="ho-chapters" className="hb-domain__head">
          <span>章</span>
          {chapters.length > 0 && <span className="hb-muted">{`${doneChapters(chapters, progress)} / ${chapters.length} 完了`}</span>}
        </h2>
        <p className="hb-muted">{chapters.length > 0 ? CHAPTERS_LEAD : NO_CHAPTERS}</p>
        {chapters.length > 0 && (
          <ul className="cmp-list">
            {chapters.map((c) => {
              const s = chapterStatus(c, progress, os);
              return <Card key={c.id} href={handsOnHref(c.id)} kicker={`${chapterNo(c)} · 約 ${c.minutes} 分`} title={c.title} lead={c.summary} done={s.done} status={s.text} />;
            })}
          </ul>
        )}
      </section>
      <section className="hb-section" aria-labelledby="ho-labs">
        <h2 id="ho-labs" className="hb-domain__head">
          <span>週ごとの実習</span>
          <span className="hb-muted">{`${doneLessons(LABS.map((x) => x.lab), progress)} / ${LABS.length} 完了`}</span>
        </h2>
        <p className="hb-muted">{LABS_LEAD}</p>
        <ul className="cmp-list">
          {LABS.map(({ lab, week }) => {
            const done = progress.lessons[lab.id]?.done === true;
            return <Card key={lab.id} href={lessonHref(lab.id)} kicker={`第 ${week} 週 · ${lab.steps.length} 手順`} title={lab.title} lead={lab.goal} done={done} status={done ? '完了' : '未着手'} />;
          })}
        </ul>
      </section>
    </div>
  );
}

export default function HandsOn({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="handsOn" progress={progress} />}>
        <div className="desk">
          <HandsOnIndex progress={progress} />
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
        <HandsOnIndex progress={progress} />
      </main>
      <BottomTabs current="handsOn" reviewCount={dueReviewCount(progress, new Date())} />
    </div>
  );
}
