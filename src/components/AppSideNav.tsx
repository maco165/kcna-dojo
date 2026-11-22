import { Badge } from '@astryxdesign/core/Badge';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Text } from '@astryxdesign/core/Text';
import { AcademicCapIcon, AdjustmentsHorizontalIcon, ArrowPathIcon, BookOpenIcon, ChartBarIcon, CodeBracketIcon, CommandLineIcon, InformationCircleIcon, QueueListIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { WEEKS } from '../content/curriculum';
import SiteLogo from './SiteLogo';
import type { Progress } from '../lib/progress';
import { dueReviewCount } from '../content';
import { REPO_URL } from '../lib/links';
import { SITE_NAME, SITE_TAGLINE } from '../lib/site';
import { aboutHref, commandsHref, compareHref, examHref, glossaryHref, guideHref, handbookHref, progressHref, reviewHref, settingsHref, weekHref } from '../lib/route';
import { ExternalAnchor, GitHubMark } from './RepoLink';

/** PC の左の一覧 */
export default function AppSideNav({ current, week, progress }: { current: 'learn' | 'about' | 'settings' | 'review' | 'progress' | 'exam' | 'glossary' | 'guide' | 'handbook' | 'compare' | 'commands'; week?: number; progress: Progress }) {
  const reviewCount = dueReviewCount(progress, new Date());
  return (
    <SideNav
      header={<SideNavHeading heading={SITE_NAME} subheading={SITE_TAGLINE} icon={<SiteLogo />} headingHref={weekHref(1)} />}
      footer={
        <SideNavSection title="このサイト" isHeaderHidden>
          <SideNavItem label="このサイトについて" icon={InformationCircleIcon} href={aboutHref} isSelected={current === 'about'} />
          <SideNavItem label="GitHub のリポジトリ" icon={() => <GitHubMark size={20} />} href={REPO_URL} as={ExternalAnchor} />
        </SideNavSection>
      }
    >
      <SideNavSection title="メニュー" isHeaderHidden>
        <SideNavItem label="学習" icon={QueueListIcon} href={weekHref(week ?? 1)} isSelected={current === 'learn'} />
        <SideNavItem
          label="復習"
          icon={ArrowPathIcon}
          href={reviewHref}
          isSelected={current === 'review'}
          endContent={reviewCount > 0 ? <Badge label={reviewCount} variant="info" /> : undefined}
        />
        <SideNavItem label="進捗" icon={ChartBarIcon} href={progressHref} isSelected={current === 'progress'} />
        <SideNavItem label="設定" icon={AdjustmentsHorizontalIcon} href={settingsHref} isSelected={current === 'settings'} />
      </SideNavSection>
      {/* 問題を解く前に読んで、足りないところを補うページ */}
      <SideNavSection title="学ぶ前に・補う">
        <SideNavItem label="Kubernetes とこのサイト" icon={AcademicCapIcon} href={guideHref} isSelected={current === 'guide'} />
        <SideNavItem label="ハンドブック" icon={CommandLineIcon} href={handbookHref()} isSelected={current === 'handbook'} />
        <SideNavItem label="用語集" icon={BookOpenIcon} href={glossaryHref} isSelected={current === 'glossary'} />
        <SideNavItem label="似た語の比較表" icon={TableCellsIcon} href={compareHref()} isSelected={current === 'compare'} />
        <SideNavItem label="コマンド" icon={CodeBracketIcon} href={commandsHref()} isSelected={current === 'commands'} />
      </SideNavSection>
      <SideNavSection title="週">
        {WEEKS.map((w) => {
          const lessons = w.content?.lessons ?? [];
          const done = lessons.filter((l) => progress.lessons[l.id]?.done).length;
          return (
            <SideNavItem
              key={w.week}
              label={`${w.week} ${w.title}`}
              href={weekHref(w.week)}
              isSelected={current === 'learn' && w.week === week}
              endContent={<Text type="supporting">{lessons.length > 0 ? `${done}/${lessons.length}` : '準備中'}</Text>}
            />
          );
        })}
        <SideNavItem label="模擬試験" href={examHref} isSelected={current === 'exam'} />
      </SideNavSection>
    </SideNav>
  );
}
