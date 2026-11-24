// ハンドブックのデータの検査。違反を文で返す (空なら OK)
import { codeKeys, unreadable } from './codeKeys';

const TOPIC_KEYS = new Set(['id', 'competency', 'title', 'summary', 'flow', 'try', 'lessons', 'sources', 'noTermLinks', 'short']);
const STEP_KEYS = new Set(['text', 'code', 'output', 'result', 'fields', 'lines']);
const RESULT_KEYS = new Set(['text', 'tone']);
/** 結果の文の長さの上限 (絵の 1 行に収める) */
export const RESULT_MAX = 40;
const CODE_KEYS = new Set(['language', 'text', 'title']);
const TRY_KEYS = new Set(['goal', 'steps']);
const FILE_KEYS = new Set(['domain', 'topics']);
/** 学習要領の外のトピックを置くファイルの domain (細目の原文とは照らさない)。「付録: Linux とコンテナ」のように段の名前を付けられる */
export const APPENDIX_DOMAIN = '付録' as const;
export type AppendixDomain = typeof APPENDIX_DOMAIN | `${typeof APPENDIX_DOMAIN}: ${string}`;
export const isAppendixDomain = (d: unknown): d is AppendixDomain => typeof d === 'string' && (d === APPENDIX_DOMAIN || (d.startsWith(`${APPENDIX_DOMAIN}: `) && d.slice(APPENDIX_DOMAIN.length + 2).trim() !== ''));
/** 目次に出す段の名前 (「付録: Linux とコンテナ」→「Linux とコンテナ」) */
export const appendixGroup = (d: AppendixDomain) => (d === APPENDIX_DOMAIN ? '' : d.slice(APPENDIX_DOMAIN.length + 2));

function unknownKeys(obj: Record<string, unknown>, allowed: Set<string>, where: string, errors: string[]) {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) errors.push(`${where}: ${k} という欄は使いません`);
}
const LANGS = new Set(['bash', 'yaml', 'hcl', 'dockerfile']);

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 設定項目の意味: サンプルの項目すべてに 1 つずつあり、サンプルに無い項目や、トピックに無い出典を書かない */
function checkFields(f: unknown, code: unknown, w: string, errors: string[], topicUrls: unknown[]) {
  if (!isObj(f) || !Array.isArray(f.items) || !Array.isArray(f.sources) || f.sources.length === 0) return void errors.push(`${w}: fields は items と sources を持ちます`);
  if (!isObj(code) || !isText(code.text) || !isText(code.title)) return void errors.push(`${w}: fields は title のあるコードに付けます`);
  unknownKeys(f, new Set(['items', 'sources']), `${w}.fields`, errors);
  for (const u of f.sources) if (!topicUrls.includes(u)) errors.push(`${w}: fields の出典 ${String(u)} が、トピックの sources にありません`);
  if (f.items.length === 0) errors.push(`${w}: fields の items が空です`);
  for (const l of unreadable(code.language as string, code.text)) errors.push(`${w}: 項目を読み取れない書き方です: ${l.trim()}`);
  const want = codeKeys(code.language as string, code.text);
  const got: string[] = [];
  for (const it of f.items) {
    if (!isObj(it) || !isText(it.text) || !Array.isArray(it.keys) || it.keys.length === 0) errors.push(`${w}: fields の項目は keys と text を持ちます`);
    else {
      unknownKeys(it, new Set(['keys', 'text']), `${w}.fields`, errors);
      got.push(...(it.keys as string[]));
    }
  }
  for (const k of want) if (!got.includes(k)) errors.push(`${w}: サンプルの項目 ${k} の意味がありません`);
  for (const k of got) if (!want.includes(k)) errors.push(`${w}: ${k} という項目はサンプルにありません`);
  if (new Set(got).size !== got.length) errors.push(`${w}: fields に同じ項目が重なっています`);
}

function checkSteps(steps: unknown, where: string, errors: string[], min: number, topicUrls: unknown[]) {
  if (!Array.isArray(steps) || steps.length < min) {
    errors.push(`${where}: ${min} 段以上が要ります`);
    return;
  }
  steps.forEach((s, i) => {
    const w = `${where}[${i}]`;
    if (!isObj(s) || !isText(s.text)) return void errors.push(`${w}: text がありません`);
    unknownKeys(s, STEP_KEYS, w, errors);
    if (isObj(s.code)) unknownKeys(s.code, CODE_KEYS, `${w}.code`, errors);
    if (s.result !== undefined) {
      if (!isObj(s.result) || !isText(s.result.text) || !['ok', 'warn'].includes(s.result.tone as string)) errors.push(`${w}: result は text と tone (ok か warn) を持ちます`);
      else {
        unknownKeys(s.result, RESULT_KEYS, `${w}.result`, errors);
        if ((s.result.text as string).length > RESULT_MAX) errors.push(`${w}: result は ${RESULT_MAX} 字までにします`);
        if (!s.code) errors.push(`${w}: result はコードのある手順にだけ付けます`);
      }
    }
    if (s.code !== undefined && !(isObj(s.code) && LANGS.has(s.code.language as string) && isText(s.code.text))) errors.push(`${w}: code は language (bash か yaml か hcl か dockerfile) と text を持ちます`);
    if (s.fields !== undefined && s.result !== undefined) errors.push(`${w}: fields のある段に result は付けません (画面に出ないため)`);
    if (s.fields !== undefined) checkFields(s.fields, s.code, w, errors, topicUrls);
    else if (isObj(s.code) && (s.code.title !== undefined || s.code.language === 'hcl' || s.code.language === 'dockerfile')) errors.push(`${w}: ファイルのサンプル (title のあるコード) には fields が要ります`);
    if (s.lines !== undefined) {
      const want = isObj(s.code) && s.code.language === 'bash' && isText(s.code.text) ? s.code.text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')) : [];
      const got: unknown[] = Array.isArray(s.lines) ? s.lines : [];
      if (want.length === 0 || got.some((l) => !isObj(l) || !isText(l.text)) || JSON.stringify(got.map((l) => (l as { code?: unknown }).code)) !== JSON.stringify(want)) errors.push(`${w}: lines は bash のコードの全部の行に、並びのとおり code と text を持ちます`);
    }
    if (s.output !== undefined && !isText(s.output)) errors.push(`${w}: output は文字列にします`);
  });
}

/**
 * @param data 分野ごとのファイルの中身の配列
 * @param domains 分野ごとの細目の原文 (学習要領の正本 content/guide.ts の CURRICULUM から)
 * @param lessonIds 実在するレッスンの id
 */
export function validateHandbook(data: unknown[], domains: Map<string, string[]>, lessonIds: Set<string>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const covered = new Set<string>();
  const seenDomains = new Set<string>();
  for (const [fi, file] of data.entries()) {
    const appendix = isObj(file) && isAppendixDomain(file.domain);
    if (!isObj(file) || !(appendix || domains.has(file.domain as string)) || !Array.isArray(file.topics)) {
      errors.push(`ファイル ${fi}: domain (4 分野のどれかか、${APPENDIX_DOMAIN} か「${APPENDIX_DOMAIN}: 段の名前」) と topics の配列が要ります`);
      continue;
    }
    unknownKeys(file, FILE_KEYS, `ファイル ${fi}`, errors);
    if (seenDomains.has(file.domain as string)) errors.push(`ファイル ${fi}: ${file.domain} のファイルが 2 つあります`);
    seenDomains.add(file.domain as string);
    const competencies = appendix ? [] : domains.get(file.domain as string)!;
    if (appendix && file.topics.length === 0) errors.push(`${file.domain}: トピックが 1 つ以上要ります`);
    for (const t of file.topics as unknown[]) {
      if (!isObj(t)) {
        errors.push(`${file.domain}: トピックがオブジェクトではありません`);
        continue;
      }
      const id = isText(t.id) ? t.id : '(id なし)';
      for (const k of Object.keys(t)) if (!TOPIC_KEYS.has(k)) errors.push(`${id}: ${k} という欄は使いません`);
      if (!isText(t.id) || !/^[a-z0-9-]+$/.test(t.id)) errors.push(`${id}: id は kebab-case にします`);
      else if (ids.has(t.id)) errors.push(`${id}: id が重複しています`);
      else ids.add(t.id);
      if (appendix) {
        // 付録は学習要領の外なので、細目の原文ではなく見出しの短い文を competency に書く
        if (!isText(t.competency)) errors.push(`${id}: competency (目次の小見出し) が要ります`);
        else if (covered.has(t.competency as string)) errors.push(`${id}: competency ${t.competency} のトピックが 2 つあります`);
        else covered.add(t.competency as string);
      } else if (!competencies.includes(t.competency as string)) errors.push(`${id}: competency が ${file.domain} の細目の原文と合いません`);
      else if (covered.has(t.competency as string)) errors.push(`${id}: 細目 ${t.competency} のトピックが 2 つあります`);
      else covered.add(t.competency as string);
      if (!isText(t.title) || !isText(t.summary)) errors.push(`${id}: title と summary が要ります`);
      const topicUrls = Array.isArray(t.sources) ? t.sources.map((s) => (isObj(s) ? s.url : undefined)) : [];
      checkSteps(t.flow, `${id}.flow`, errors, 3, topicUrls);
      if (!Array.isArray(t.try) || t.try.length === 0) errors.push(`${id}: try (試す手順) が 1 つ以上要ります`);
      else
        t.try.forEach((x, i) => {
          if (!isObj(x) || !isText(x.goal)) return void errors.push(`${id}.try[${i}]: goal がありません`);
          unknownKeys(x, TRY_KEYS, `${id}.try[${i}]`, errors);
          checkSteps(x.steps, `${id}.try[${i}].steps`, errors, 1, topicUrls);
        });
      if (!Array.isArray(t.lessons)) errors.push(`${id}: lessons の配列が要ります`);
      else {
        for (const l of t.lessons) if (!lessonIds.has(l as string)) errors.push(`${id}: lessons の ${String(l)} というレッスンはありません`);
        if (new Set(t.lessons).size !== t.lessons.length) errors.push(`${id}: lessons に同じレッスンが重なっています`);
      }
      if (!Array.isArray(t.sources) || t.sources.length === 0) errors.push(`${id}: sources が要ります`);
      else {
        const urls = t.sources.map((s) => (isObj(s) ? s.url : undefined));
        if (new Set(urls).size !== urls.length) errors.push(`${id}: sources に同じ URL が重なっています`);
        for (const s of t.sources) {
          try {
            if (!isObj(s) || !isText(s.label) || new URL(s.url as string).protocol !== 'https:') errors.push(`${id}: sources は label と https の url を持ちます`);
          } catch {
            errors.push(`${id}: sources の url が読めません`);
          }
        }
      }
    }
  }
  for (const [domain, competencies] of domains) {
    if (!seenDomains.has(domain)) errors.push(`${domain} のファイルがありません`);
    for (const c of competencies) if (seenDomains.has(domain) && !covered.has(c)) errors.push(`細目 ${c} のトピックがありません`);
  }
  return errors;
}
