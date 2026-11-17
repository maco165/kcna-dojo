// 説明のページ (#/guide) に載せる、公式の情報の写し。事実ごとに出典を持つ。
// 確かめた日: 2026-11-18。数字を変えるときは出典を開き直し、CHECKED_AT も直す。
import type { Domain } from './types';

export const CHECKED_AT = '2026-11-18';

export type Source = { label: string; url: string };

export const SOURCES = {
  k8sOverview: { label: 'kubernetes.io の概要', url: 'https://kubernetes.io/ja/docs/concepts/overview/' },
  cncfK8s: { label: 'cncf.io の Kubernetes', url: 'https://www.cncf.io/projects/kubernetes/' },
  kcnaJp: { label: 'LF の KCNA-JP のページ', url: 'https://training.linuxfoundation.org/ja/certification/kubernetes-and-cloud-native-associate-kcna-jp/' },
  mcInstructions: { label: '多肢選択式試験の受験の注意', url: 'https://docs.linuxfoundation.org/tc-docs/certification/important-instructions-mc' },
  mcFaq: { label: '多肢選択式試験の FAQ', url: 'https://docs.linuxfoundation.org/tc-docs/certification/faq-mc' },
  language: { label: '試験の言語', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/language' },
  curriculum: { label: 'CNCF の公開カリキュラム (KCNA_Curriculum.pdf)', url: 'https://github.com/cncf/curriculum/blob/master/KCNA_Curriculum.pdf' },
  agreement: { label: '認定試験の同意書 (守秘)', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-cert-agreement/' },
} satisfies Record<string, Source>;

/** Kubernetes の名前と生まれ */
export const ORIGIN = {
  word: 'κυβερνήτης',
  meaning: 'ギリシャ語で「操舵手」「パイロット」',
  milestones: [
    { year: '2014', text: 'Google がオープンソースに' },
    { year: '2016', text: 'CNCF のプロジェクトに' },
    { year: '2018', text: 'Graduated (安定) に' },
  ],
  sources: [SOURCES.k8sOverview, SOURCES.cncfK8s],
};

/** 公式の定義 (kubernetes.io の概要の文をそのまま引く) */
export const DEFINITION =
  '宣言的な構成管理と自動化を促進し、コンテナ化されたワークロードやサービスを管理するための、ポータブルで拡張性のあるオープンソースのプラットフォーム';

/** Kubernetes がしてくれること (kubernetes.io の概要の「Kubernetes は以下を提供します」を短くしたもの) */
export const PROVIDES: { name: string; text: string }[] = [
  { name: '自己修復', text: '落ちたコンテナを立て直し、応えないものは入れ替える' },
  { name: 'サービスディスカバリと負荷分散', text: '名前で届け、混んだら通信を振り分ける' },
  { name: 'ロールアウトとロールバック', text: '新しい版へ少しずつ移し、だめなら戻す' },
  { name: '自動ビンパッキング', text: 'CPU とメモリの要求を見て、置くノードを決める' },
  { name: 'ストレージオーケストレーション', text: '選んだストレージを自動でつなぐ' },
  { name: '機密情報と構成の管理', text: 'イメージを作り直さずに設定とパスワードを差し替える' },
];

/** KCNA-JP の形式。note は「KCNA と名指しの記述ではない」などの但し書き */
export const EXAM_FACTS: { label: string; value: string; note?: string; source: Source }[] = [
  { label: '形式', value: 'オンラインの監督付き・多肢選択式', source: SOURCES.kcnaJp },
  { label: '時間', value: '90 分', source: SOURCES.kcnaJp },
  { label: '問題数', value: '60 問', note: 'LF の多肢選択式試験に共通の記述', source: SOURCES.mcInstructions },
  { label: '合格', value: '75% 以上', note: 'LF の多肢選択式試験に共通の記述', source: SOURCES.mcFaq },
  { label: '言語', value: '問題は日本語、監督者は英語。日本語版として申し込む', source: SOURCES.language },
  { label: '有効期間', value: '2 年', source: SOURCES.kcnaJp },
  { label: '受験料', value: '$250 (再受験 1 回つき)', source: SOURCES.kcnaJp },
];

export const EXAM_PURPOSE =
  'Kubernetes と、より広いクラウドネイティブのエコシステムの基礎の知識とスキルを証明する試験です。経験は初心者向けで、前提の資格はありません。';

/**
 * 学習要領 = 公開カリキュラムの細目 (英語は KCNA_Curriculum.pdf の見出し、日本語は LF の KCNA-JP のページの訳)。
 * weeks はこのサイトで主に学ぶ週。配点は lib/exam.ts の EXAM_WEIGHTS
 */
export const CURRICULUM: { domain: Domain; competencies: { en: string; ja: string; weeks: number[] }[] }[] = [
  {
    domain: 'Kubernetes Fundamentals',
    competencies: [
      { en: 'Kubernetes Core Concepts', ja: 'Kubernetes コアコンセプト', weeks: [2, 3] },
      { en: 'Administration', ja: '管理', weeks: [4] },
      { en: 'Scheduling', ja: 'スケジューリング', weeks: [4] },
      { en: 'Containerization', ja: 'コンテナ化', weeks: [1] },
    ],
  },
  {
    domain: 'Container Orchestration',
    competencies: [
      { en: 'Networking', ja: 'ネットワーク', weeks: [5] },
      { en: 'Security', ja: 'セキュリティ', weeks: [6] },
      { en: 'Troubleshooting', ja: 'トラブルシューティング', weeks: [6] },
      { en: 'Storage', ja: 'ストレージ', weeks: [6] },
    ],
  },
  {
    domain: 'Cloud Native Application Delivery',
    competencies: [
      { en: 'Application Delivery', ja: 'アプリケーション配信', weeks: [7] },
      { en: 'Debugging', ja: 'デバッグ', weeks: [7] },
    ],
  },
  {
    domain: 'Cloud Native Architecture',
    competencies: [
      { en: 'Observability', ja: '可観測性', weeks: [8] },
      { en: 'Cloud Native Ecosystem and Principles', ja: 'クラウドネイティブエコシステムと原則', weeks: [8] },
      { en: 'Cloud Native Community and Collaboration', ja: 'クラウドネイティブコミュニティとコラボレーション', weeks: [8] },
    ],
  },
];
export const CURRICULUM_VERSION = '2025-11-24 の版';

/** 見本に出す問題 (実際の第 1 週の問題) */
export const SAMPLE_QUESTION_ID = 'w1-l3-q1';

/** 問題の出典のサイト (ホスト → 名前と入口)。出典の内訳に名前とリンクを付けるのに使う */
export const SOURCE_SITES: Record<string, Source> = {
  'kubernetes.io': { label: 'Kubernetes の公式ドキュメント', url: 'https://kubernetes.io/ja/docs/home/' },
  'kubectl.docs.kubernetes.io': { label: 'kubectl と Kustomize の公式ドキュメント', url: 'https://kubectl.docs.kubernetes.io/' },
  'docs.k3s.io': { label: 'k3s の公式ドキュメント', url: 'https://docs.k3s.io/' },
  'helm.sh': { label: 'Helm の公式ドキュメント', url: 'https://helm.sh/ja/docs/' },
  'docs.docker.com': { label: 'Docker の公式ドキュメント', url: 'https://docs.docker.com/' },
  'glossary.cncf.io': { label: 'CNCF のクラウドネイティブ用語集', url: 'https://glossary.cncf.io/ja/' },
  'www.cncf.io': { label: 'CNCF のプロジェクトの一覧', url: 'https://www.cncf.io/projects/' },
  'opentelemetry.io': { label: 'OpenTelemetry の公式ドキュメント', url: 'https://opentelemetry.io/ja/docs/' },
  'prometheus.io': { label: 'Prometheus の公式ドキュメント', url: 'https://prometheus.io/docs/' },
  'grafana.com': { label: 'Grafana の公式ドキュメント', url: 'https://grafana.com/docs/grafana/latest/' },
  'opencontainers.org': { label: 'Open Container Initiative', url: 'https://opencontainers.org/' },
  'argo-cd.readthedocs.io': { label: 'Argo CD の公式ドキュメント', url: 'https://argo-cd.readthedocs.io/' },
  'fluxcd.io': { label: 'Flux の公式ドキュメント', url: 'https://fluxcd.io/flux/' },
  'opengitops.dev': { label: 'OpenGitOps (GitOps の原則)', url: 'https://opengitops.dev/' },
  'knative.dev': { label: 'Knative の公式ドキュメント', url: 'https://knative.dev/docs/' },
  'sre.google': { label: 'Google の SRE の本', url: 'https://sre.google/books/' },
  'github.com': { label: 'GitHub 上の各プロジェクトのリポジトリ', url: 'https://github.com/' },
};

/** 公式の学習素材 (LF の KCNA-JP のページに載っているもの) */
export const STUDY_MATERIALS: (Source & { note: string })[] = [
  { label: 'KCNA の学習パス (PDF)', url: 'https://training.linuxfoundation.org/wp-content/uploads/2024/10/KCNA.pdf', note: 'LF が出している学ぶ順の案内' },
  { label: 'Introduction to Kubernetes', url: 'https://training.linuxfoundation.org/ja/training/introduction-to-kubernetes/', note: '無料の入門講座' },
  { label: 'Kubernetes とクラウドネイティブ基礎 (LFS250-JP)', url: 'https://training.linuxfoundation.org/ja/training/kubernetes-and-cloud-native-essentials-lfs250-jp/', note: '日本語の有料講座' },
  { ...SOURCES.curriculum, note: '出題範囲の正本 (英語)' },
];
