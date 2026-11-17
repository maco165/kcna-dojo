import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Text } from '@astryxdesign/core/Text';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BookOpenIcon,
  ChartBarIcon,
  InformationCircleIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { WEEKS } from '../content/curriculum';
import SiteLogo from './SiteLogo';
import type { Progress } from '../lib/progress';
import { REPO_URL } from '../lib/links';
import { SITE_NAME, SITE_TAGLINE } from '../lib/site';
import { aboutHref, weekHref } from '../lib/route';
import { GitHubMark } from './RepoLink';

/** PC の左の一覧。学習と週のほかは、まだ機能が無いので「準備中」として押せない */
export default function AppSideNav({ current, week, progress }: { current: 'learn' | 'about'; week?: number; progress: Progress }) {
  const soon = <Text type="supporting">準備中</Text>;
  return (
    <SideNav
      header={<SideNavHeading heading={SITE_NAME} subheading={SITE_TAGLINE} icon={<SiteLogo />} headingHref={weekHref(1)} />}
      footer={
        <SideNavSection title="このサイト" isHeaderHidden>
          <SideNavItem label="このサイトについて" icon={InformationCircleIcon} href={aboutHref} isSelected={current === 'about'} />
          <SideNavItem label="GitHub のリポジトリ" icon={() => <GitHubMark size={20} />} href={REPO_URL} />
        </SideNavSection>
      }
    >
      <SideNavSection title="メニュー" isHeaderHidden>
        <SideNavItem label="学習" icon={QueueListIcon} href={weekHref(week ?? 1)} isSelected={current === 'learn'} />
        <SideNavItem label="復習" icon={ArrowPathIcon} isDisabled endContent={soon} />
        <SideNavItem label="進捗" icon={ChartBarIcon} isDisabled endContent={soon} />
        <SideNavItem label="用語集" icon={BookOpenIcon} isDisabled endContent={soon} />
        <SideNavItem label="設定" icon={AdjustmentsHorizontalIcon} isDisabled endContent={soon} />
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
        <SideNavItem label="模擬試験" isDisabled endContent={soon} />
      </SideNavSection>
    </SideNav>
  );
}
