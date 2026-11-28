// 学習要領の 13 細目 (正本)。説明のページ (guide.ts が読み直して出す) と、進捗の画面の受験の目安が読む。
// 進捗の画面が説明のページの文 (EXAM_DAY など) まで読まないよう、guide.ts から分けた
import type { Domain } from './types';

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
