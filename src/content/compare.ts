// 似た語の比較表のデータ。正本は compare.json (公式の文書で確かめて書く)。比較表の画面と、用語集の「比べる」と、書き出す HTML が読む
import data from './compare.json';

export type CompareTable = {
  id: string;
  /** 検索で引かれる言い方 (例「Deployment・StatefulSet・DaemonSet・Job の違い」) */
  title: string;
  /** ページの題名 (<title>) に使う短い名前。title が長くて題名が 35 字を超えるときだけ持つ (src/lib/pageTitle.ts の withSite) */
  short?: string;
  lead: string;
  /** 比べるもの。term は用語集の id */
  columns: { name: string; term?: string }[];
  /** 比べる観点。cells の数は columns と同じ */
  rows: { label: string; cells: string[] }[];
  /** 試験で取り違えやすい点 */
  pitfalls: string[];
  /** 違いが見えるコード */
  example: { language: string; title: string; code: string }[];
  sources: { label: string; url: string }[];
};

export const COMPARE_TABLES = data as CompareTable[];

export const findTable = (id: string) => COMPARE_TABLES.find((t) => t.id === id);

/** 表のページの短い題名 (画面・書き出す HTML で共通) */
export const tableTitle = (id: string) => {
  const t = findTable(id);
  return t ? (t.short ?? t.title) : '似た語の比較表';
};

/** その語を列に持つ比較表 (用語集の「比べる」に出す) */
export const tablesOfTerm = (termId: string) => COMPARE_TABLES.filter((t) => t.columns.some((c) => c.term === termId));
