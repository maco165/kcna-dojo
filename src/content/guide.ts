// 説明のページ (#/guide) に載せる、公式の情報の写し。事実ごとに出典を持つ。
// 確かめた日: 2026-11-18。数字を変えるときは出典を開き直し、CHECKED_AT も直す。
import { EXAM_MINUTES, EXAM_QUESTIONS, PASS_MARK } from '../lib/exam';
import type { Domain } from './types';

export const CHECKED_AT = '2026-11-18';

export type Source = { label: string; url: string };

export const SOURCES = {
  k8sOverview: { label: 'kubernetes.io の概要', url: 'https://kubernetes.io/ja/docs/concepts/overview/' },
  k8sOverviewEn: { label: 'kubernetes.io の概要 (英語)', url: 'https://kubernetes.io/docs/concepts/overview/' },
  cncfK8s: { label: 'cncf.io の Kubernetes', url: 'https://www.cncf.io/projects/kubernetes/' },
  kcnaJp: { label: 'LF の KCNA-JP のページ', url: 'https://training.linuxfoundation.org/ja/certification/kubernetes-and-cloud-native-associate-kcna-jp/' },
  mcInstructions: { label: '多肢選択式試験の受験の注意', url: 'https://docs.linuxfoundation.org/tc-docs/certification/important-instructions-mc' },
  mcFaq: { label: '多肢選択式試験の FAQ', url: 'https://docs.linuxfoundation.org/tc-docs/certification/faq-mc' },
  language: { label: '試験の言語', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/language' },
  curriculum: { label: 'CNCF の公開カリキュラム (KCNA_Curriculum.pdf)', url: 'https://github.com/cncf/curriculum/blob/master/KCNA_Curriculum.pdf' },
  agreement: { label: '認定試験の同意書 (守秘)', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-cert-agreement/' },
  kcna: { label: 'LF の KCNA のページ (英語)', url: 'https://training.linuxfoundation.org/certification/kubernetes-cloud-native-associate/' },
  scheduling: { label: '受験者ハンドブック: 予約・変更・取り消し', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/scheduling-or-rescheduling-an-exam' },
  identification: { label: '受験者ハンドブック: 本人確認', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/candidate-identification-and-authentication' },
  takingExam: { label: '受験者ハンドブック: 受験の当日', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/taking-the-exam' },
  noPass: { label: '受験者ハンドブック: 不合格のとき', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/exam-scoring-and-notification/exam-results-no-pass' },
  certificates: { label: '受験者ハンドブック: 認定と有効期限', url: 'https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2/certificates-and-certification' },
} satisfies Record<string, Source>;

/** Kubernetes の名前と生まれ */
export const ORIGIN = {
  /** 英語版の概要の言い方 (meaning helmsman or pilot) */
  word: 'helmsman / pilot',
  meaning: 'ギリシャ語に由来し、操舵手やパイロットを意味する',
  milestones: [
    { year: '2014', text: 'Google がオープンソースに' },
    { year: '2016', text: 'CNCF のプロジェクトに' },
    { year: '2018', text: 'Graduated の段階に' },
  ],
  sources: [SOURCES.k8sOverview, SOURCES.k8sOverviewEn, SOURCES.cncfK8s],
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
export const EXAM_FACTS: { label: string; value: string; note?: string; sources: Source[] }[] = [
  { label: '形式', value: 'オンラインの監督付き・多肢選択式', sources: [SOURCES.kcnaJp] },
  { label: '時間', value: `${EXAM_MINUTES} 分`, sources: [SOURCES.kcnaJp, SOURCES.mcInstructions] },
  { label: '問題数', value: `${EXAM_QUESTIONS} 問`, note: 'LF の多肢選択式試験に共通の記述', sources: [SOURCES.mcInstructions] },
  { label: '合格の目安', value: `${Math.round(PASS_MARK * 100)}% 以上 (目安)`, note: 'KCNA の試験のページに合格点の数字は無い。LF の多肢選択式試験の FAQ に共通の記述で、KCNA と名指しではない', sources: [SOURCES.mcFaq] },
  { label: '言語', value: '問題は日本語。日本語版として申し込む。監督者は英語を話すが、試験のブラウザで日本語を選ぶと監督者・サポートとのやり取りは自動翻訳の日本語になる', sources: [SOURCES.kcnaJp, SOURCES.language] },
  { label: '有効期間', value: '2 年', sources: [SOURCES.kcnaJp] },
  { label: '受験料', value: '$250 (再受験 1 回つき)', sources: [SOURCES.kcnaJp] },
];

/** 受験の当日までの案内を確かめた日。出典を開き直して文を変えたら、ここも直す (CHECKED_AT と同じ考え) */
export const EXAM_DAY_CHECKED_AT = '2026-11-28';

/**
 * 受験の当日までの案内 (申し込みから更新まで)。項目ごとに、確かめた公式の文書を出典に持つ。
 * 公式に無いこと (休憩の扱いなど) は書かない
 */
export const EXAM_DAY: { id: string; title: string; items: { text: string; sources: Source[] }[] }[] = [
  {
    id: 'register',
    title: '申し込みと予約',
    items: [
      { text: '申し込んだ日から 12 か月のうちに、予約して受験します。', sources: [SOURCES.kcnaJp, SOURCES.scheduling] },
      { text: '予約は 90 日先まで取れます。前日までに取る必要があり (24 時間前から)、受験の開始の 24 時間前を切ると、予約の変更も取り消しもできません。', sources: [SOURCES.scheduling] },
      { text: '予約した時刻に受けなかった (no-show) ときは、受験料は返らず、再受験もできません。', sources: [SOURCES.scheduling] },
    ],
  },
  {
    id: 'identity',
    title: '本人確認',
    items: [
      { text: '有効期限内の、政府が発行した身分証の原本が要ります。コピーや電子のものは使えず、仮の身分証も使えません。', sources: [SOURCES.identification, SOURCES.mcInstructions] },
      { text: '身分証の姓と名は、受験のチェックリストに登録した名前と完全に一致している必要があります。身分証のつづりのとおりに登録します。', sources: [SOURCES.identification, SOURCES.mcInstructions] },
      { text: '名前・写真・署名のある身分証を使います。パスポート、運転免許証、マイナンバーカードなどが挙がっています。', sources: [SOURCES.identification] },
    ],
  },
  {
    id: 'room',
    title: '機材と部屋',
    items: [
      { text: '試験は PSI のセキュアブラウザで受けます。開始の時刻になるとダウンロードできます。', sources: [SOURCES.mcInstructions, SOURCES.takingExam] },
      { text: 'Web カメラは、部屋を映して回せるものにします。マイクは始める前に動くか確かめます。モニターは 1 台だけで、2 台は使えません。', sources: [SOURCES.mcInstructions] },
      { text: '人のいない静かな個室で受け、ドアがあれば閉めます。机の上には、受験に使う機器のほかに紙・筆記用具・電子機器などを置きません。', sources: [SOURCES.mcInstructions] },
    ],
  },
  {
    id: 'day',
    title: '当日の流れ',
    items: [
      { text: '予約の 30 分前から、My Portal の Take Exam で始められます。セキュアブラウザで、同意書への同意・身分証の写真・自分の写真を出し (自己チェックイン)、担当者が部屋と机をカメラで確かめたあと、監督者が付きます。', sources: [SOURCES.takingExam] },
      { text: '予約の時刻から 30 分のうちに始めないと、no-show になります。', sources: [SOURCES.takingExam] },
      { text: '多肢選択式の 60 問を 90 分で解きます。途中で切れたらセキュアブラウザから入り直しますが、時間は止まりません。', sources: [SOURCES.mcInstructions, SOURCES.takingExam] },
    ],
  },
  {
    id: 'result',
    title: '結果',
    items: [
      { text: '終わってから 24 時間のうちに、結果がメールで届きます。', sources: [SOURCES.mcFaq, SOURCES.mcInstructions] },
      { text: '多肢選択式の試験は 75% 以上で合格です (LF の多肢選択式の試験に共通の記述)。', sources: [SOURCES.mcFaq] },
    ],
  },
  {
    id: 'retake',
    title: '再受験',
    items: [
      { text: '受験料には再受験 1 回が含まれます。合格しなかったら、受験のチェックリストの「Claim Your Retake」から再受験を申し込みます。', sources: [SOURCES.kcnaJp, SOURCES.noPass] },
    ],
  },
  {
    id: 'renew',
    title: '有効期限と更新',
    items: [
      { text: '認定は 2 年 (24 か月) で切れます。', sources: [SOURCES.kcnaJp, SOURCES.certificates] },
      { text: '切れる前に同じ試験にもう一度合格すると、その日から 2 年に延びます。', sources: [SOURCES.mcFaq, SOURCES.certificates] },
      { text: 'CKA か CKAD に合格すると、KCNA は自動で更新されます (CARE の仕組み)。', sources: [SOURCES.mcFaq] },
    ],
  },
];

export const EXAM_PURPOSE =
  'Kubernetes と、より広いクラウドネイティブのエコシステムの基礎の知識とスキルを証明する試験です。経験は初心者向けで、前提の資格はありません。';

/**
 * 学習要領 = 公開カリキュラムの細目 (英語は KCNA_Curriculum.pdf の見出し、日本語は LF の KCNA-JP のページの訳)。
 * weeks はこのサイトで主に学ぶ週。topic はその細目のハンドブックのトピック (competency が同じことは tests/handbook.test.ts が見る)。配点は lib/exam.ts の EXAM_WEIGHTS
 */
export const CURRICULUM: { domain: Domain; competencies: { en: string; ja: string; weeks: number[]; /** この細目のハンドブックのトピックの id (受験の目安から開く) */ topic: string }[] }[] = [
  {
    domain: 'Kubernetes Fundamentals',
    competencies: [
      { en: 'Kubernetes Core Concepts', ja: 'Kubernetes コアコンセプト', weeks: [2, 3], topic: 'core-concepts' },
      { en: 'Administration', ja: '管理', weeks: [4], topic: 'administration' },
      { en: 'Scheduling', ja: 'スケジューリング', weeks: [4], topic: 'scheduling' },
      { en: 'Containerization', ja: 'コンテナ化', weeks: [1], topic: 'containerization' },
    ],
  },
  {
    domain: 'Container Orchestration',
    competencies: [
      { en: 'Networking', ja: 'ネットワーク', weeks: [5], topic: 'networking' },
      { en: 'Security', ja: 'セキュリティ', weeks: [6], topic: 'security' },
      { en: 'Troubleshooting', ja: 'トラブルシューティング', weeks: [6], topic: 'troubleshooting' },
      { en: 'Storage', ja: 'ストレージ', weeks: [6], topic: 'storage' },
    ],
  },
  {
    domain: 'Cloud Native Application Delivery',
    competencies: [
      { en: 'Application Delivery', ja: 'アプリケーション配信', weeks: [7], topic: 'application-delivery' },
      { en: 'Debugging', ja: 'デバッグ', weeks: [7], topic: 'debugging' },
    ],
  },
  {
    domain: 'Cloud Native Architecture',
    competencies: [
      { en: 'Observability', ja: '可観測性', weeks: [8], topic: 'observability' },
      { en: 'Cloud Native Ecosystem and Principles', ja: 'クラウドネイティブエコシステムと原則', weeks: [8], topic: 'cloud-native-principles' },
      { en: 'Cloud Native Community and Collaboration', ja: 'クラウドネイティブコミュニティとコラボレーション', weeks: [8], topic: 'cloud-native-community' },
    ],
  },
];
export const CURRICULUM_VERSION = '2026-03-22 の版';

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
  'git-scm.com': { label: 'Git の公式ドキュメント', url: 'https://git-scm.com/docs' },
  'github.com': { label: 'GitHub 上の各プロジェクトのリポジトリ', url: 'https://github.com/' },
};

/** 公式の学習素材 (LF の KCNA-JP のページに載っているもの) */
export const STUDY_MATERIALS: (Source & { note: string })[] = [
  { label: 'KCNA の学習パス (PDF)', url: 'https://training.linuxfoundation.org/wp-content/uploads/2024/10/KCNA.pdf', note: 'LF が出している学ぶ順の案内' },
  { label: 'Introduction to Kubernetes', url: 'https://training.linuxfoundation.org/ja/training/introduction-to-kubernetes/', note: '無料の入門講座' },
  { label: 'Kubernetes とクラウドネイティブ基礎 (LFS250-JP)', url: 'https://training.linuxfoundation.org/ja/training/kubernetes-and-cloud-native-essentials-lfs250-jp/', note: '日本語の有料講座' },
  { ...SOURCES.curriculum, note: '出題範囲の正本 (英語)' },
];
