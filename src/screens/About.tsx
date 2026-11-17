import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ArrowTopRightOnSquareIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import AppSideNav from '../components/AppSideNav';
import BottomTabs from '../components/BottomTabs';
import RepoLink, { GitHubMark } from '../components/RepoLink';
import SiteLogo from '../components/SiteLogo';
import { NEW_ISSUE_URL, REPO_URL } from '../lib/links';
import type { Progress } from '../lib/progress';
import { dueQuestions } from '../content';
import { SITE_NAME, SITE_TAGLINE } from '../lib/site';
import { WIDE_QUERY, useMediaQuery } from '../lib/useMediaQuery';


const external = <ArrowTopRightOnSquareIcon width={16} height={16} />;

function Body() {
  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Text type="supporting">
          {SITE_NAME} · {SITE_TAGLINE}
        </Text>
        <h1 className="week-title">このサイトについて</h1>
        <Text type="supporting">
          {SITE_NAME} (クラウドネイティブの略) は、KCNA-JP (Kubernetes and Cloud Native Associate 日本語版) の対策のための、個人が作った非公式の学習サイトです。コマンドや YAML の穴埋め・4 択を週ごとのレッスンで解きます。
        </Text>
        <Text type="supporting">The Linux Foundation・CNCF とは関係ありません。Kubernetes と KCNA は The Linux Foundation の商標です。</Text>
      </VStack>

      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">ソースコード</h2>
          <Text type="supporting">サイトのコードと問題のデータは、すべて GitHub で公開しています。</Text>
          <div>
            <Button
              variant="primary"
              label="GitHub のリポジトリを開く"
              icon={<GitHubMark />}
              endContent={external}
              href={REPO_URL}
              target="_blank" rel="noopener noreferrer"
            />
          </div>
          <span className="caption-code">github.com/maco165/kcna-dojo</span>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <h2 className="h-sm">問題の誤りを見つけたら</h2>
          <Text type="supporting">
            問題は公式の文書 (kubernetes.io・docs.k3s.io など) で確かめて書いていますが、誤りがあれば Issue で知らせてください。問題の id (例: w1-l3-q2) を添えると早く直せます。
          </Text>
          <div>
            <Button label="Issue を書く" icon={<ExclamationCircleIcon width={18} height={18} />} endContent={external} href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" />
          </div>
        </VStack>
      </Card>

      <List hasDividers header={<h2 className="h-sm">知っておくこと</h2>}>
        <ListItem label="記録の置き場所" description="進み具合はこのブラウザの localStorage (キー kcna.v1) にだけ残り、サーバーには送りません。" />
        <ListItem label="AI に聞く" description="問題文を入れた Claude / ChatGPT を新しいタブで開くだけで、送るかどうかは開いた先で決めます。" />
        <ListItem label="問題について" description="実際の試験問題は写していません。各問の解説の下に出典を付けています。" />
        <ListItem
          label="ライセンス"
          description={
            <Text type="supporting">
              MIT (
              <Link href={`${REPO_URL}/blob/main/LICENSE`} isExternalLink newTabLabel="(新しいタブで開きます)">
                LICENSE
              </Link>
              )
            </Text>
          }
        />
      </List>
    </VStack>
  );
}

export default function About({ progress }: { progress: Progress }) {
  const isWide = useMediaQuery(WIDE_QUERY);
  if (isWide) {
    return (
      <AppShell contentPadding={0} variant="section" sideNav={<AppSideNav current="about" progress={progress} />}>
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
      <BottomTabs current="about" reviewCount={dueQuestions(progress, new Date()).length} />
    </div>
  );
}
