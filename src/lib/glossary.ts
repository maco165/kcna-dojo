// 用語集: 問題に出る用語の短い説明。データの正本は src/content/glossary.json
export type GlossaryTerm = {
  id: string;
  term: string;
  aliases?: string[];
  description: string;
  source: string;
  lessons: string[];
};

/** 検索のための形にそろえる (大文字・小文字と全角・半角の違いを無くす) */
export function normalizeText(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 用語・別名・説明から探す。空白で区切った語をすべて含むものを、
 * 用語か別名に当たるものを先に、説明だけに当たるものを後に並べる
 */
export function searchTerms(terms: GlossaryTerm[], query: string): GlossaryTerm[] {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (words.length === 0) return terms;
  const head: GlossaryTerm[] = [];
  const body: GlossaryTerm[] = [];
  for (const t of terms) {
    const names = normalizeText([t.term, ...(t.aliases ?? [])].join(' '));
    const all = `${names} ${normalizeText(t.description)}`;
    if (!words.every((w) => all.includes(w))) continue;
    (words.some((w) => names.includes(w)) ? head : body).push(t);
  }
  return [...head, ...body];
}

/** 読みの順 (日本語の並び) に並べる */
export function sortTerms(terms: GlossaryTerm[]): GlossaryTerm[] {
  return [...terms].sort((a, b) => a.term.localeCompare(b.term, 'ja'));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** 用語集のデータの検査。違反を文で返す (空なら OK) */
export function validateGlossary(data: unknown, knownLessonIds: Set<string>): string[] {
  const errors: string[] = [];
  const terms = (data as { terms?: unknown })?.terms;
  if (!Array.isArray(terms)) return ['terms の配列がありません'];
  const ids = new Set<string>();
  const names = new Map<string, string>();
  terms.forEach((t: Record<string, unknown>, i) => {
    const where = isNonEmptyString(t?.id) ? t.id : `#${i}`;
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
    else for (const l of t.lessons) if (!knownLessonIds.has(l as string)) errors.push(`${where}: lessons の ${String(l)} というレッスンはありません`);
    for (const n of [t?.term, ...((t?.aliases as unknown[]) ?? [])]) {
      if (!isNonEmptyString(n)) continue;
      const key = normalizeText(n);
      const owner = names.get(key);
      if (owner && owner !== where) errors.push(`${where}: 「${n}」は ${owner} と重なっています`);
      else names.set(key, where);
    }
  });
  return errors;
}
