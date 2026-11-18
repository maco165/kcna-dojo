// 本文の中の用語集の語を見つけ、用語集へのリンクにする (ハンドブックで使う)
import type { GlossaryTerm } from './glossary';

export type TermPiece = string | { text: string; id: string };

const ASCII = /[A-Za-z0-9]/;
/** 英数字の語は、前後が英数字・ハイフン・ドット・下線でないときだけ当てる (Pod が Pods や PodSecurity に当たらないように) */
const WORD_CHAR = /[A-Za-z0-9_.-]/;
/** カタカナの語は、前後がカタカナでないときだけ当てる (コントロールの中のロール、データベースの中のベースに当てない) */
const KATAKANA = /[\u30A1-\u30FA\u30FC]/;
/** 本文ではふつうの言葉として使うことが多く、用語集の語の意味に限らない別名 (Service の「サービス」など) */
const TOO_GENERAL = new Set(['サービス', 'リクエスト', 'ロードバランサー']);
/** 漢字で始まる語は、直前がカタカナか漢字なら当てない (ネットワーク名前空間は Linux の名前空間で、Namespace ではない) */
const KANJI = /[\u4E00-\u9FFF]/;
const KANA_OR_KANJI = /[\u30A1-\u30FA\u30FC\u4E00-\u9FFF]/;

/**
 * 語と別名から、本文に当てる名前の一覧を作る。長い名前を先に試す (kube-controller-manager を controller より先に)。
 * 括弧の付いた名前 (「CI (継続的インテグレーション)」) は括弧の前だけを使い、1 字の名前は使わない
 */
export function termNames(terms: GlossaryTerm[]): { name: string; id: string }[] {
  const out = new Map<string, string>();
  for (const t of terms) {
    for (const raw of [t.term, ...(t.aliases ?? [])]) {
      const name = raw.replace(/\s*\(.*\)\s*$/, '').trim();
      if (name.length < 2 || /[()]/.test(name) || TOO_GENERAL.has(name) || out.has(name)) continue;
      out.set(name, t.id);
    }
  }
  return [...out].map(([name, id]) => ({ name, id })).sort((a, b) => b.name.length - a.name.length);
}

/**
 * 1 ページの中で、それぞれの語の最初の 1 回だけをリンクにする関数を作る (同じ語が何度もリンクになると読みにくい)。
 * 描く順に呼ぶ
 */
export function makeTermLinker(names: { name: string; id: string }[]) {
  const seen = new Set<string>();
  return (text: string): TermPiece[] => {
    const out: TermPiece[] = [];
    let rest = text;
    let plain = '';
    outer: while (rest) {
      for (const { name, id } of names) {
        if (!rest.startsWith(name)) continue;
        const last = out[out.length - 1];
        const before = plain ? plain.slice(-1) : last ? (typeof last === 'string' ? last : last.text).slice(-1) : '';
        const after = rest.charAt(name.length);
        if (ASCII.test(name.charAt(0)) && WORD_CHAR.test(before)) continue;
        if (ASCII.test(name.charAt(name.length - 1)) && WORD_CHAR.test(after)) continue;
        if (KATAKANA.test(name.charAt(0)) && KATAKANA.test(before)) continue;
        if (KANJI.test(name.charAt(0)) && KANA_OR_KANJI.test(before)) continue;
        if (KATAKANA.test(name.charAt(name.length - 1)) && KATAKANA.test(after)) continue;
        if (seen.has(id)) {
          // 2 回目からは文字のまま。長い名前ごと飛ばして、中の短い語に当たらないようにする
          plain += name;
        } else {
          seen.add(id);
          if (plain) out.push(plain);
          plain = '';
          out.push({ text: name, id });
        }
        rest = rest.slice(name.length);
        continue outer;
      }
      plain += rest[0];
      rest = rest.slice(1);
    }
    if (plain) out.push(plain);
    return out;
  };
}
