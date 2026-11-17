// 用語集: 問題に出る用語の短い説明。データの正本は src/content/glossary.json
export type GlossaryTerm = {
  id: string;
  term: string;
  aliases?: string[];
  description: string;
  source: string;
  lessons: string[];
};

/**
 * 検索のための形にそろえる。大文字・小文字、全角・半角、ひらがな・カタカナの違いを無くし、
 * 語の中のハイフンと中黒を消す (kube-proxy と kubeproxy、ぽっど と ポッド を同じに扱う)
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[-‐・]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 用語・別名のどれかと語が完全一致なら 0、先頭一致なら 1、部分一致なら 2、当たらなければ 3 */
function nameRank(names: string[], words: string[]): number {
  let best = 3;
  for (const w of words) {
    for (const n of names) {
      if (n === w) return 0;
      if (n.startsWith(w)) best = Math.min(best, 1);
      else if (n.includes(w)) best = Math.min(best, 2);
    }
  }
  return best;
}

/**
 * 用語・別名・説明から探す。空白で区切った語をすべて含むものを、
 * 用語か別名に当たるものを先に、説明だけに当たるものを後に並べる
 */
export function searchTerms(terms: GlossaryTerm[], query: string): GlossaryTerm[] {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (words.length === 0) return terms;
  const hits: { t: GlossaryTerm; rank: number; i: number }[] = [];
  terms.forEach((t, i) => {
    const names = [t.term, ...(t.aliases ?? [])].map(normalizeText);
    const all = `${names.join(' ')} ${normalizeText(t.description)}`;
    if (!words.every((w) => all.includes(w))) return;
    hits.push({ t, rank: nameRank(names, words), i });
  });
  // 完全一致 > 先頭一致 > 部分一致 > 説明だけ。同じ順位では元の並びを保つ
  return hits.sort((a, b) => a.rank - b.rank || a.i - b.i).map((h) => h.t);
}

/** 読みの順 (日本語の並び) に並べる */
export function sortTerms(terms: GlossaryTerm[]): GlossaryTerm[] {
  return [...terms].sort((a, b) => a.term.localeCompare(b.term, 'ja'));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

const KEYS = new Set(['id', 'term', 'aliases', 'description', 'source', 'lessons']);

/** 用語集のデータの検査。違反を文で返す (空なら OK) */
export function validateGlossary(data: unknown, knownLessonIds: Set<string>): string[] {
  const errors: string[] = [];
  const terms = (data as { terms?: unknown })?.terms;
  if (!Array.isArray(terms)) return ['terms の配列がありません'];
  const ids = new Set<string>();
  const names = new Map<string, string>();
  terms.forEach((t: Record<string, unknown>, i) => {
    const where = isNonEmptyString(t?.id) ? t.id : `#${i}`;
    if (!t || typeof t !== 'object') {
      errors.push(`${where}: 語がオブジェクトではありません`);
      return;
    }
    for (const k of Object.keys(t)) if (!KEYS.has(k)) errors.push(`${where}: ${k} という欄は使いません (打ち間違いでないか確かめる)`);
    if (!isNonEmptyString(t?.id)) errors.push(`${where}: id がありません`);
    else if (ids.has(t.id)) errors.push(`${where}: id が重複しています`);
    else ids.add(t.id);
    if (!isNonEmptyString(t?.term)) errors.push(`${where}: term がありません`);
    if (!isNonEmptyString(t?.description)) errors.push(`${where}: description がありません`);
    if (t?.aliases !== undefined && !(Array.isArray(t.aliases) && t.aliases.every(isNonEmptyString))) errors.push(`${where}: aliases は文字列の配列にします`);
    try {
      if (!isNonEmptyString(t?.source) || new URL(t.source).protocol !== 'https:') errors.push(`${where}: source は https の URL にします`);
    } catch {
      errors.push(`${where}: source は https の URL にします`);
    }
    if (!Array.isArray(t?.lessons) || t.lessons.length === 0) errors.push(`${where}: lessons が空です`);
    else {
      for (const l of t.lessons) if (!knownLessonIds.has(l as string)) errors.push(`${where}: lessons の ${String(l)} というレッスンはありません`);
      if (new Set(t.lessons).size !== t.lessons.length) errors.push(`${where}: lessons に同じレッスンが重なっています`);
    }
    for (const n of [t.term, ...(Array.isArray(t.aliases) ? t.aliases : [])]) {
      if (!isNonEmptyString(n)) continue;
      const key = normalizeText(n);
      const owner = names.get(key);
      if (owner && owner !== where) errors.push(`${where}: 「${n}」は ${owner} と重なっています`);
      else names.set(key, where);
    }
  });
  return errors;
}
