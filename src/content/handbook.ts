// 参照ページ (ハンドブック) のデータ。学習要領 (公開カリキュラムの細目) ごとに 1 トピック。
// 正本は src/content/handbook/*.json (分野ごとに 1 ファイル)。形は lib/handbook.ts の validateHandbook が検査する
import type { Domain } from './types';
import { DOMAINS } from '../lib/lessonStatus';
import { appendixGroup, isAppendixDomain, type AppendixDomain } from '../lib/handbook';

/** title はファイルの名前 (設定ファイルのサンプルに付ける) */
export type HandbookCode = { language: 'bash' | 'yaml' | 'hcl' | 'dockerfile'; text: string; title?: string };
/** 設定ファイルのサンプルの項目の意味。keys はサンプルの項目の道 (lib/codeKeys.ts)、sources はトピックの sources の url */
export type HandbookFields = { items: { keys: string[]; text: string }[]; sources: string[] };
/** 手順のあとクラスタの中で起きること (本文に書いてある結果を短く)。ok は思いどおり、warn は失敗・止まる */
export type HandbookResult = { text: string; tone: 'ok' | 'warn' };
export type HandbookStep = { text: string; code?: HandbookCode; output?: string; result?: HandbookResult; fields?: HandbookFields; lines?: HandbookLine[] };
/** コードの 1 行と、その意味 (コマンドの行をすべて、並びのとおりに持つ) */
export type HandbookLine = { code: string; text: string };
export type HandbookTry = { goal: string; steps: HandbookStep[] };
export type HandbookTopic = {
  id: string;
  competency: string;
  title: string;
  /** ページの題名 (<title>) に使う短い名前。title が長くて題名が 35 字を超えるときだけ持つ (src/lib/pageTitle.ts の withSite) */
  short?: string;
  summary: string;
  flow: HandbookStep[];
  try: HandbookTry[];
  lessons: string[];
  /** このトピックの本文ではリンクにしない用語集の語の id (AWS の IAM のロールが Kubernetes の Role に当たる、など別の意味で使う語) */
  noTermLinks?: string[];
  sources: { label: string; url: string }[];
};
/** 学習要領の外の話 (資格の範囲の外だが、一緒に知っておいて損がないこと)。配点は無く、目次の最後に段ごとに並べる */
export { appendixGroup, isAppendixDomain };

/** 目次・パンくず・書き出す HTML に出す段の名前。付録は「範囲外: Linux とコンテナ」の形 */
export const sectionName = (d: string) => (isAppendixDomain(d) ? (appendixGroup(d) ? `範囲外: ${appendixGroup(d)}` : '範囲外') : d);
export type HandbookSection = Domain | AppendixDomain;
export type HandbookDomain = { domain: HandbookSection; topics: HandbookTopic[] };

const FILES = import.meta.glob<HandbookDomain>('./handbook/*.json', { eager: true, import: 'default' });
const ORDER: string[] = DOMAINS.map((d) => d.name);
// 付録の段はファイルの名前の順 (5-1-…, 5-2-…) で、4 分野のあとに並べる
const FILE_ORDER = Object.keys(FILES).sort();
const rank = (d: HandbookDomain) => (isAppendixDomain(d.domain) ? ORDER.length + FILE_ORDER.findIndex((k) => FILES[k] === d) : ORDER.indexOf(d.domain));

/** 分野の並び (配点の順) にそろえ、付録の段を最後に置いたハンドブック */
export const HANDBOOK: HandbookDomain[] = Object.values(FILES).sort((a, b) => rank(a) - rank(b));

export const HANDBOOK_TOPICS: (HandbookTopic & { domain: HandbookSection })[] = HANDBOOK.flatMap((d) => d.topics.map((t) => ({ ...t, domain: d.domain })));

export function findTopic(id: string) {
  const i = HANDBOOK_TOPICS.findIndex((t) => t.id === id);
  if (i < 0) return undefined;
  return { topic: HANDBOOK_TOPICS[i], prev: HANDBOOK_TOPICS[i - 1], next: HANDBOOK_TOPICS[i + 1] };
}

/** 細目の原文からトピックを引く (説明のページの学習要領の表から飛ぶため) */
export const topicByCompetency = (competency: string) => HANDBOOK_TOPICS.find((t) => !isAppendixDomain(t.domain) && t.competency === competency);

/** 目次の 2 部 (試験の範囲と範囲外)。画面と書き出す HTML で共通 */
export const HANDBOOK_PARTS = [
  { id: 'hb-part-scope', title: '試験の範囲', lead: 'KCNA-JP の学習要領の細目です。配点の高い分野から並べています。', extra: false },
  { id: 'hb-part-extra', title: '範囲外: 一緒に知っておくと役立つこと', lead: '試験には出ません。Kubernetes を実際に動かすときや、試験のあとに進むときに役立つことです。', extra: true },
].map((p) => ({ ...p, domains: HANDBOOK.filter((d) => isAppendixDomain(d.domain) === p.extra) }));
