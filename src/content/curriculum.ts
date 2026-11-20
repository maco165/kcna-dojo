// 週の並びと日付。カリキュラムの正本は本人の学習計画の文書で、ここはサイトに出すための写し。
import type { Domain, WeekContent } from './types';

// 問題データは src/content/week<n>.json を置けば、その週に自動でつながる (週ごとの PR が同じファイルを触らないため)
const CONTENT_FILES = import.meta.glob<WeekContent>('./week*.json', { eager: true, import: 'default' });
const CONTENT_BY_WEEK = new Map<number, WeekContent>(Object.values(CONTENT_FILES).map((c) => [c.week, c]));

export type WeekMeta = {
  week: number;
  title: string;
  domain: Domain;
  area: string;
  /** その週の始まりの日 (月曜) */
  start: string;
  /** 説明できるようにすること */
  goals: string[];
  /**
   * 先に読むハンドブックのトピック。label はトピックの題名の頭 (短い呼び名)。
   * ホームはハンドブックのデータを読まないので、ここに id と呼び名だけを持つ (実在・題名との一致・その週のレッスンとの紐づけは tests/preRead.test.ts が見る)
   */
  read: { topic: string; label: string }[];
  content?: WeekContent;
};

const WEEK_LIST: Omit<WeekMeta, 'content'>[] = [
  {
    week: 1,
    title: 'コンテナの基礎',
    domain: 'Kubernetes Fundamentals',
    area: 'Containerization',
    start: '2026-11-23',
    goals: ['コンテナはなぜ VM より軽いか', 'OCI と CRI は何を標準にしたか', 'k3s は Docker を使っているか'],
    read: [{ topic: 'containerization', label: 'コンテナ化' }],
  },
  {
    week: 2,
    title: 'クラスタの構成',
    domain: 'Kubernetes Fundamentals',
    area: 'Core Concepts',
    start: '2026-11-30',
    goals: ['Pod を作る命令が動くまでに通る部品の順番', 'etcd が止まると何が起きるか', '望ましい状態とは何か'],
    read: [{ topic: 'core-concepts', label: 'Kubernetes の中心の考え方' }],
  },
  {
    week: 3,
    title: 'ワークロード',
    domain: 'Kubernetes Fundamentals',
    area: 'Core Concepts',
    start: '2026-12-07',
    goals: ['Deployment と StatefulSet の使い分け', 'DaemonSet が向く用途', 'ラベルが無いと何が困るか'],
    read: [{ topic: 'core-concepts', label: 'Kubernetes の中心の考え方' }],
  },
  {
    week: 4,
    title: '管理とスケジューリング',
    domain: 'Kubernetes Fundamentals',
    area: 'Administration / Scheduling',
    start: '2026-12-14',
    goals: ['スケジューラは何を見て置き場所を決めるか', 'taint と toleration の向き', 'limits を超えた CPU とメモリの違い'],
    read: [{ topic: 'administration', label: 'クラスタの管理' }, { topic: 'scheduling', label: 'スケジューリング' }],
  },
  {
    week: 5,
    title: 'ネットワーク',
    domain: 'Container Orchestration',
    area: 'Networking',
    start: '2026-12-21',
    goals: ['Service が無いと Pod に何が困るか', 'Ingress と LoadBalancer の違い', 'イングレスの移行で何が変わるか'],
    read: [{ topic: 'networking', label: 'ネットワーク' }],
  },
  {
    week: 6,
    title: 'セキュリティ・ストレージ・障害対応',
    domain: 'Container Orchestration',
    area: 'Security / Storage / Troubleshooting',
    start: '2027-01-04',
    goals: ['Role と ClusterRole の違い', 'PV と PVC を分ける理由', 'CrashLoopBackOff のとき最初に見るもの'],
    read: [{ topic: 'security', label: 'セキュリティ' }, { topic: 'storage', label: 'ストレージ' }, { topic: 'troubleshooting', label: '障害対応' }],
  },
  {
    week: 7,
    title: 'アプリの届け方',
    domain: 'Cloud Native Application Delivery',
    area: 'Application Delivery / Debugging',
    start: '2027-01-11',
    goals: ['GitOps は何を正本にするか', 'Helm と Kustomize の違い', 'カナリアの利点'],
    read: [{ topic: 'application-delivery', label: 'アプリを届ける流れ' }, { topic: 'debugging', label: '動かないアプリの原因を探す' }],
  },
  {
    week: 8,
    title: 'クラウドネイティブの設計',
    domain: 'Cloud Native Architecture',
    area: 'Observability / Ecosystem',
    start: '2027-01-18',
    goals: ['メトリクスとトレースで分かることの違い', 'SLO を決める理由', 'Graduated になる条件のあらまし'],
    read: [{ topic: 'observability', label: 'オブザーバビリティ' }, { topic: 'cloud-native-principles', label: 'クラウドネイティブの考え方' }, { topic: 'cloud-native-community', label: 'クラウドネイティブのコミュニティ' }],
  },
];

export const WEEKS: WeekMeta[] = WEEK_LIST.map((w) => ({ ...w, content: CONTENT_BY_WEEK.get(w.week) }));
