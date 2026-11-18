// 用語集: 問題に出る用語の短い説明。データの正本は src/content/glossary.json
export type GlossaryTerm = {
  id: string;
  term: string;
  aliases?: string[];
  /** 一覧の 1 行目に出す短い説明 (1〜2 文) */
  description: string;
  /** 開いたときの詳しい説明 (初学者向け。何か・なぜ要るか・どう使うか・似た語との違い)。段落は空行で分ける */
  detail?: string;
  source: string;
  /** 詳しい説明の根拠 (source のほかに) */
  sources?: { label: string; url: string }[];
  /** 出てくるレッスン。試験の範囲の外の語は空で、代わりに topics を持つ */
  lessons: string[];
  /** 説明しているハンドブックのトピックの id */
  topics?: string[];
};

/** 語を AI に聞くときの文 (Claude / ChatGPT の入力欄に入れる) */
export function termQuestion(t: Pick<GlossaryTerm, 'term' | 'description'>): string {
  return [
    'KCNA-JP (Kubernetes and Cloud Native Associate) の勉強をしている初学者です。',
    `「${t.term}」について、用語集で次の説明を読みました: ${t.description}`,
    'まだよく分からないので、身近なたとえと kubectl などの具体例を使って、日本語でやさしく説明してください。似た用語との違いもあれば教えてください。',
  ].join('\n');
}

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
export function searchTerms<T extends GlossaryTerm>(terms: T[], query: string): T[] {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (words.length === 0) return terms;
  const hits: { t: T; rank: number; i: number }[] = [];
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
export function sortTerms<T extends GlossaryTerm>(terms: T[]): T[] {
  return [...terms].sort((a, b) => a.term.localeCompare(b.term, 'ja'));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

const KEYS = new Set(['id', 'term', 'aliases', 'description', 'detail', 'source', 'sources', 'lessons', 'topics']);

/** 用語集のデータの検査。違反を文で返す (空なら OK) */
export function validateGlossary(data: unknown, knownLessonIds: Set<string>, knownTopicIds: Set<string> = new Set()): string[] {
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
    if (t?.detail !== undefined && !isNonEmptyString(t.detail)) errors.push(`${where}: detail は文字列にします`);
    if (t?.sources !== undefined) {
      if (!Array.isArray(t.sources)) errors.push(`${where}: sources は配列にします`);
      else
        for (const x of t.sources as { label?: unknown; url?: unknown }[]) {
          let ok = isNonEmptyString(x?.label) && isNonEmptyString(x?.url);
          try {
            ok = ok && new URL(x.url as string).protocol === 'https:';
          } catch {
            ok = false;
          }
          if (!ok) errors.push(`${where}: sources は label と https の url を持ちます`);
        }
    }
    const topics = Array.isArray(t?.topics) ? (t.topics as unknown[]) : [];
    if (t?.topics !== undefined && !Array.isArray(t.topics)) errors.push(`${where}: topics は配列にします`);
    for (const x of topics) if (!knownTopicIds.has(x as string)) errors.push(`${where}: topics の ${String(x)} というトピックはありません`);
    // 試験の範囲の語はレッスンで、範囲の外の語はハンドブックのトピックで、どこで出てくるかを示す
    if (!Array.isArray(t?.lessons) || (t.lessons.length === 0 && topics.length === 0)) errors.push(`${where}: lessons が空です (範囲の外の語なら topics を付ける)`);
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

/**
 * 語の分野。その語が出てくるレッスンの分野でいちばん多いもの (同じ数なら order の順で先のもの)。
 * レッスンが 1 つも見つからなければ undefined
 */
export function termDomain<D extends string>(t: GlossaryTerm, domainOf: (lessonId: string) => D | undefined, order: readonly D[]): D | undefined {
  const count = new Map<D, number>();
  for (const id of t.lessons) {
    const d = domainOf(id);
    if (d) count.set(d, (count.get(d) ?? 0) + 1);
  }
  let best: D | undefined;
  for (const d of order) if ((count.get(d) ?? 0) > 0 && (best === undefined || count.get(d)! > count.get(best)!)) best = d;
  return best;
}
