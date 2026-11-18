// 参照ページ (ハンドブック) のデータ。学習要領 (公開カリキュラムの細目) ごとに 1 トピック。
// 正本は src/content/handbook/*.json (分野ごとに 1 ファイル)。形は lib/handbook.ts の validateHandbook が検査する
import type { Domain } from './types';
import { DOMAINS } from '../lib/lessonStatus';
import { APPENDIX_DOMAIN } from '../lib/handbook';

export type HandbookCode = { language: 'bash' | 'yaml'; text: string };
/** 手順のあとクラスタの中で起きること (本文に書いてある結果を短く)。ok は思いどおり、warn は失敗・止まる */
export type HandbookResult = { text: string; tone: 'ok' | 'warn' };
export type HandbookStep = { text: string; code?: HandbookCode; output?: string; result?: HandbookResult };
export type HandbookTry = { goal: string; steps: HandbookStep[] };
export type HandbookTopic = {
  id: string;
  competency: string;
  title: string;
  summary: string;
  flow: HandbookStep[];
  try: HandbookTry[];
  lessons: string[];
  sources: { label: string; url: string }[];
};
/** 学習要領の外の話 (k3s と Kubernetes の違いなど)。配点は無く、目次の最後に並べる */
export const APPENDIX = APPENDIX_DOMAIN;
export type HandbookSection = Domain | typeof APPENDIX;
export type HandbookDomain = { domain: HandbookSection; topics: HandbookTopic[] };

const FILES = import.meta.glob<HandbookDomain>('./handbook/*.json', { eager: true, import: 'default' });
const ORDER: HandbookSection[] = [...DOMAINS.map((d) => d.name), APPENDIX];

/** 分野の並び (配点の順) にそろえ、付録を最後に置いたハンドブック */
export const HANDBOOK: HandbookDomain[] = Object.values(FILES).sort((a, b) => ORDER.indexOf(a.domain) - ORDER.indexOf(b.domain));

export const HANDBOOK_TOPICS: (HandbookTopic & { domain: HandbookSection })[] = HANDBOOK.flatMap((d) => d.topics.map((t) => ({ ...t, domain: d.domain })));

export function findTopic(id: string) {
  const i = HANDBOOK_TOPICS.findIndex((t) => t.id === id);
  if (i < 0) return undefined;
  return { topic: HANDBOOK_TOPICS[i], prev: HANDBOOK_TOPICS[i - 1], next: HANDBOOK_TOPICS[i + 1] };
}

/** 細目の原文からトピックを引く (説明のページの学習要領の表から飛ぶため) */
export const topicByCompetency = (competency: string) => HANDBOOK_TOPICS.find((t) => t.domain !== APPENDIX && t.competency === competency);
