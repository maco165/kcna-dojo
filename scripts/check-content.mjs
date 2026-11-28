#!/usr/bin/env node
// 問題データ (src/content/week*.json) と実践の章 (src/content/hands-on/*.json) の検査。src/content/types.ts と同じ欄を見る。
// 使い方: node scripts/check-content.mjs [ファイル ...]   (省略すると全部。置き場所が exam/ なら模擬試験用の問題、hands-on/ なら実践の章として見る)
// 通れば "OK <ファイル>" を出して終了コード 0。1 つでも違えば "NG <ファイル> <id>: <理由>" を出して終了コード 1。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { privateWords } from './private-words.mjs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT_DIR = join(ROOT, 'src/content');
const DOMAINS = [
  'Kubernetes Fundamentals',
  'Container Orchestration',
  'Cloud Native Application Delivery',
  'Cloud Native Architecture',
];
const LANGUAGES = ['bash', 'yaml', 'dockerfile'];
const HANDS_ON_DIR = join(CONTENT_DIR, 'hands-on');
const BLANK = '{{blank}}';
/** 1 レッスン (quiz) に要る問題の数 (PJ-028 の R-6) */
const MIN_QUESTIONS = 5;

const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync(CONTENT_DIR)
      .filter((f) => /^week\d+\.json$/.test(f))
      .sort()
      .map((f) => join(CONTENT_DIR, f))
      // 模擬試験用の問題 (レッスンに無い初見の問題)。週を持たないので week は 0
      .concat(readdirSync(join(CONTENT_DIR, 'exam')).filter((f) => f.endsWith('.json')).sort().map((f) => join(CONTENT_DIR, 'exam', f)))
      // 実践の章 (まだ 1 章も無ければ、置き場所そのものが無い)
      .concat(existsSync(HANDS_ON_DIR) ? readdirSync(HANDS_ON_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => join(HANDS_ON_DIR, f)) : []);

const seenIds = new Map(); // id -> file
let failed = false;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function isHttpsUrl(v) {
  if (!isNonEmptyString(v)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/** 実在する日付 (YYYY-MM-DD) か。日付に直して戻した文字と同じかで見る (2026-02-31 は落とす)。src/lib/progress.ts の isValidDay と同じ考え */
function isValidDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` === v;
}
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v) => typeof v === 'string' && /^[a-z0-9-]+$/.test(v);

/* ---------- 実践の章 (src/content/hands-on/*.json) ---------- */

const CHAPTER_KEYS = ['id', 'order', 'title', 'short', 'summary', 'goal', 'features', 'minutes', 'needs', 'reads', 'steps', 'cleanup', 'challenges', 'sources'];
const STEP_KEYS = ['id', 'text', 'why', 'os', 'where', 'code', 'lines', 'output', 'read', 'trouble', 'source', 'unverified', 'optional'];
/** code のある手順だけが持つ欄 */
const CODE_ONLY_KEYS = ['lines', 'output', 'read', 'trouble', 'unverified'];
const CODE_LANGUAGES = ['bash', 'powershell', 'yaml', 'text'];
/** ページの題名の上限 (src/lib/pageTitle.ts の TITLE_MAX) */
const TITLE_MAX = 35;
/** 学習要領の細目 (ハンドブックの試験の範囲のトピックの competency。その正本の CURRICULUM との一致は tests/handbook.test.ts が見る) */
const COMPETENCIES = new Set(readdirSync(join(CONTENT_DIR, 'handbook')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(CONTENT_DIR, 'handbook', f), 'utf8'))).filter((d) => !String(d.domain).startsWith('付録')).flatMap((d) => d.topics.map((t) => t.competency)));
const OSES = ['windows', 'mac', 'linux'];
const seenOrders = new Map(); // order -> file
const topicIds = new Set(readdirSync(join(CONTENT_DIR, 'handbook')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(CONTENT_DIR, 'handbook', f), 'utf8')).topics.map((t) => t.id)));

/** 中の文字列を全部集める (JSON の \\n などの書き方に惑わされないよう、読み込んだ値で見る) */
const strings = (v) => (typeof v === 'string' ? [v] : isObject(v) || Array.isArray(v) ? Object.values(v).flatMap(strings) : []);

function checkChapter(c, name, ng, claimId) {
  if (!isObject(c)) return ng('-', '章のオブジェクトにします');
  const cid = isNonEmptyString(c.id) ? c.id : '-';
  claimId(c.id, '-');
  if (!isId(c.id)) ng(cid, 'id は kebab-case にします');
  const unknown = (obj, keys, where) => {
    for (const k of Object.keys(obj)) if (!keys.includes(k)) ng(cid, `${where}${k} という欄は使いません`);
  };
  unknown(c, CHAPTER_KEYS, '');
  if (!Number.isInteger(c.order) || c.order < 0) ng(cid, 'order (章の番号) は 0 以上の整数にします');
  else if (seenOrders.has(c.order)) ng(cid, `order ${c.order} が重複しています (${seenOrders.get(c.order)} と)`);
  else seenOrders.set(c.order, name);
  if (!Number.isInteger(c.minutes) || c.minutes < 1) ng(cid, 'minutes (かかる分) は 1 以上の整数にします');
  for (const key of ['title', 'summary', 'goal']) if (!isNonEmptyString(c[key])) ng(cid, `${key} がありません`);
  if (c.short !== undefined && !isNonEmptyString(c.short)) ng(cid, 'short は空でない文字列にします');
  if ([...String(c.short ?? c.title ?? '')].length > TITLE_MAX) ng(cid, `title が ${TITLE_MAX} 字を超えます。${TITLE_MAX} 字までの short を付けます`);
  for (const key of ['features', 'needs']) if (!Array.isArray(c[key]) || c[key].length === 0 || !c[key].every(isNonEmptyString)) ng(cid, `${key} が 1 つ以上要ります`);

  if (!Array.isArray(c.reads)) ng(cid, 'reads (先に読むトピックの配列) がありません');
  else {
    for (const [i, r] of c.reads.entries()) {
      if (!isObject(r) || !isNonEmptyString(r.topic) || !isNonEmptyString(r.label)) ng(cid, `reads[${i}] は topic と label を持ちます`);
      else if (!topicIds.has(r.topic)) ng(cid, `reads[${i}] の ${r.topic} というハンドブックのトピックはありません`);
      if (isObject(r)) unknown(r, ['topic', 'label'], `reads[${i}] の `);
    }
  }

  const stepIds = new Set();
  for (const key of ['steps', 'cleanup']) {
    if (!Array.isArray(c[key]) || c[key].length === 0) {
      ng(cid, `${key} が 1 つ以上要ります`);
      continue;
    }
    for (const [i, s] of c[key].entries()) {
      const w = `${key}[${i}]`;
      if (!isObject(s)) {
        ng(cid, `${w} は手順のオブジェクトにします`);
        continue;
      }
      unknown(s, STEP_KEYS, `${w} の `);
      if (!isId(s.id)) ng(cid, `${w} に id (kebab-case) がありません`);
      else if (stepIds.has(s.id)) ng(cid, `${w} の id ${s.id} が章の中で重複しています`);
      else stepIds.add(s.id);
      for (const k of ['text', 'why']) if (!isNonEmptyString(s[k])) ng(cid, `${w} に ${k} がありません`);
      if (s.os !== undefined && !OSES.includes(s.os)) ng(cid, `${w} の os は windows / mac / linux のどれかにします`);
      if (s.optional !== undefined && s.optional !== true) ng(cid, `${w} の optional は true だけを書きます`);
      if (s.optional !== undefined && key === 'cleanup') ng(cid, `${w} の optional は手順 (steps) にだけ書きます`);
      if (s.where !== undefined && !['host', 'vm'].includes(s.where)) ng(cid, `${w} の where は host か vm にします`);
      for (const k of ['output', 'read', 'unverified']) if (s[k] !== undefined && !isNonEmptyString(s[k])) ng(cid, `${w} の ${k} は空でない文字列にします`);
      if (s.source !== undefined && !isHttpsUrl(s.source)) ng(cid, `${w} の source は https の URL にします`);
      if (s.code === undefined) {
        for (const k of CODE_ONLY_KEYS) if (s[k] !== undefined) ng(cid, `${w} の ${k} は code のある手順にだけ付けます`);
        continue;
      }
      if (!isObject(s.code) || !CODE_LANGUAGES.includes(s.code.language) || !isNonEmptyString(s.code.text)) {
        ng(cid, `${w} の code は language (${CODE_LANGUAGES.join(' / ')}) と text を持ちます`);
        continue;
      }
      unknown(s.code, ['language', 'text', 'title'], `${w} の code の `);
      if (s.code.title !== undefined && !isNonEmptyString(s.code.title)) ng(cid, `${w} の code.title は空でない文字列にします`);
      // 空の行と # で始まる行を除く全部の行に、並びのとおり意味を付ける (ハンドブックの lines と同じ)
      const want = s.code.text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
      const got = Array.isArray(s.lines) ? s.lines : [];
      if (got.length === 0 || got.some((l) => !isObject(l) || !isNonEmptyString(l.text)) || JSON.stringify(got.map((l) => l?.code)) !== JSON.stringify(want)) {
        ng(cid, `${w} の lines は code の全部の行に、並びのとおり code と text を持ちます`);
      }
      for (const l of got) if (isObject(l)) unknown(l, ['code', 'text'], `${w} の lines の `);
      if (s.output === undefined && s.unverified === undefined) ng(cid, `${w} に output (実機の出力) がありません。実機で確かめていなければ unverified に書きます`);
      if (s.output !== undefined && s.unverified !== undefined) ng(cid, `${w} は output (実機の出力) と unverified (実機で未確認) を両方持てません`);
      if (s.read === undefined) ng(cid, `${w} に read (出力の読み方) がありません`);
      if (s.source === undefined) ng(cid, `${w} に source (出典の https の URL) がありません`);
      if (!Array.isArray(s.trouble) || s.trouble.length === 0) ng(cid, `${w} に trouble (つまずいた時) が 1 件以上要ります`);
      for (const [ti, t] of (Array.isArray(s.trouble) ? s.trouble : []).entries()) {
        for (const k of ['symptom', 'check', 'fix']) if (!isNonEmptyString(t?.[k])) ng(cid, `${w} の trouble[${ti}] に ${k} がありません`);
        if (isObject(t)) unknown(t, ['symptom', 'check', 'fix'], `${w} の trouble[${ti}] の `);
      }
    }
  }

  // どの OS を選んでも、する手順があること (0 件だと、何もせずに完了にできてしまう)
  if (Array.isArray(c.steps)) {
    // 任意の手順 (optional) は完了の条件に入らないので、任意でない手順で数える
    for (const os of OSES) if (!c.steps.some((s) => !s?.optional && (s?.os === undefined || s?.os === os))) ng(cid, `${os} の人がする手順 (steps。任意でないもの) が 1 つもありません`);
  }
  for (const w of privateWords(strings(c).join('\n'))) ng(cid, `載せてはいけない名前・住所があります: ${w}`);

  if (!Array.isArray(c.challenges) || c.challenges.length === 0) ng(cid, 'challenges (課題) が 1 つ以上要ります');
  for (const [i, x] of (Array.isArray(c.challenges) ? c.challenges : []).entries()) {
    for (const k of ['task', 'hint', 'answer', 'verify']) if (!isNonEmptyString(x?.[k])) ng(cid, `challenges[${i}] に ${k} がありません`);
    if (isObject(x)) unknown(x, ['task', 'hint', 'answer', 'verify'], `challenges[${i}] の `);
  }
  if (!Array.isArray(c.sources) || c.sources.length === 0) ng(cid, 'sources (出典) が 1 つ以上要ります');
  const urls = (Array.isArray(c.sources) ? c.sources : []).map((s) => s?.url);
  if (new Set(urls).size !== urls.length) ng(cid, 'sources に同じ URL が重なっています');
  for (const [i, s] of (Array.isArray(c.sources) ? c.sources : []).entries()) {
    if (!isNonEmptyString(s?.label) || !isHttpsUrl(s?.url)) ng(cid, `sources[${i}] は label と https の url を持ちます`);
    if (isObject(s)) unknown(s, ['label', 'url'], `sources[${i}] の `);
  }
}

for (const file of files) {
  const name = relative(process.cwd(), file);
  const errors = [];
  const ng = (id, msg) => errors.push(`NG ${name} ${id}: ${msg}`);
  const claimId = (id, where) => {
    if (!isNonEmptyString(id)) {
      ng(where, 'id がありません');
      return;
    }
    if (seenIds.has(id)) ng(id, `id が重複しています (${seenIds.get(id)} と)`);
    else seenIds.set(id, name);
  };

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`NG ${name} -: JSON として読めません (${e.message})`);
    failed = true;
    continue;
  }

  const folder = basename(dirname(resolve(file)));
  const chapterFile = folder === 'hands-on';
  // 模擬試験用のファイル (exam/ の下) は週を持たないので week 0。レッスンと問題の id は x- で始め、4 択か穴埋めのレッスンだけを持つ
  const examFile = folder === 'exam';
  if (chapterFile) checkChapter(data, name, ng, claimId);
  else if (examFile) {
    if (data.week !== 0) ng('-', '模擬試験用のファイル (exam/ の下) は week を 0 にします');
    for (const l of data.lessons ?? []) {
      if (!String(l?.id).startsWith('x-') || l?.kind !== 'quiz') ng(l?.id ?? '-', '模擬試験用のファイル (exam/ の下) のレッスンは、id が x- で始まる quiz にします');
      for (const q of l?.questions ?? []) if (!String(q?.id).startsWith('x-')) ng(q?.id ?? '-', '模擬試験用の問題の id は x- で始めます');
    }
  } else if (!Number.isInteger(data.week) || data.week < 1) ng('-', 'week は 1 以上の整数にします');
  if (!chapterFile && (!Array.isArray(data.lessons) || data.lessons.length === 0)) ng('-', 'lessons がありません');

  for (const [li, lesson] of (chapterFile ? [] : (data.lessons ?? [])).entries()) {
    const lid = lesson?.id ?? `lessons[${li}]`;
    claimId(lesson?.id, `lessons[${li}]`);
    for (const key of ['title', 'summary']) if (!isNonEmptyString(lesson?.[key])) ng(lid, `${key} がありません`);
    if (!DOMAINS.includes(lesson?.domain)) ng(lid, `domain が試験の 4 分野のどれでもありません (${lesson?.domain})`);

    if (lesson?.kind === 'lab') {
      if (!isHttpsUrl(lesson.source)) ng(lid, 'source (出典の https の URL) がありません');
      if (!isNonEmptyString(lesson.goal)) ng(lid, 'goal (この実習で分かること) がありません');
      if (!Array.isArray(lesson.needs) || lesson.needs.length === 0 || !lesson.needs.every(isNonEmptyString)) ng(lid, 'needs (用意するもの) が 1 つ以上要ります');
      if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) ng(lid, 'steps がありません');
      for (const [si, step] of (lesson.steps ?? []).entries()) {
        if (!isNonEmptyString(step?.text)) ng(lid, `steps[${si}] に text がありません`);
        if (step?.command !== undefined && !isNonEmptyString(step.command)) ng(lid, `steps[${si}] の command が空です`);
        // 初めての人が成功かどうかを見分けられるよう、打つ手順には見えるはずのものを必ず書く
        if (step?.command !== undefined && !isNonEmptyString(step.expect)) ng(lid, `steps[${si}] に expect (うまくいくと見えるもの) がありません`);
        if (step?.stuck !== undefined && !isNonEmptyString(step.stuck)) ng(lid, `steps[${si}] の stuck が空です`);
      }
      continue;
    }
    if (lesson?.kind !== 'quiz') {
      ng(lid, `kind は quiz か lab にします (${lesson?.kind})`);
      continue;
    }
    // 週のレッスンは、学習要領の細目のどれか 1 つを持つ (模擬試験用の問題は細目が混ざるので持たない)
    if (!examFile && !COMPETENCIES.has(lesson.competency)) ng(lid, `competency が学習要領の細目のどれでもありません (${lesson.competency})`);
    if (lesson.since !== undefined && (examFile || !isValidDay(lesson.since))) ng(lid, 'since (足した日) は週のレッスンにだけ、YYYY-MM-DD で書きます');
    if (examFile && lesson.competency !== undefined) ng(lid, '模擬試験用のファイルのレッスンには competency を書きません');
    if (!Array.isArray(lesson.questions) || lesson.questions.length < MIN_QUESTIONS) {
      ng(lid, `questions は ${MIN_QUESTIONS} 問以上要ります (${lesson.questions?.length ?? 0} 問)`);
    }

    for (const [qi, q] of (lesson.questions ?? []).entries()) {
      const qid = q?.id ?? `${lid}.questions[${qi}]`;
      claimId(q?.id, `${lid}.questions[${qi}]`);
      for (const key of ['prompt', 'explanation']) if (!isNonEmptyString(q?.[key])) ng(qid, `${key} がありません`);
      if (!isHttpsUrl(q?.source)) ng(qid, 'source (出典の https の URL) がありません');

      if (q?.type === 'fill') {
        if (!LANGUAGES.includes(q.language)) ng(qid, `language は ${LANGUAGES.join(' / ')} のどれかにします`);
        const blanks = isNonEmptyString(q.code) ? q.code.split(BLANK).length - 1 : 0;
        if (blanks !== 1) ng(qid, `code に ${BLANK} はちょうど 1 つ要ります (${blanks} 個)`);
        if (!Array.isArray(q.answers) || q.answers.length === 0 || !q.answers.every(isNonEmptyString)) {
          ng(qid, 'answers (正解の配列) がありません');
        }
        if (q.candidates !== undefined) {
          if (!Array.isArray(q.candidates) || !q.candidates.every(isNonEmptyString)) ng(qid, 'candidates は文字列の配列にします');
          else if (new Set(q.candidates).size !== q.candidates.length) ng(qid, 'candidates に同じものがあります');
          else if (!q.candidates.some((c) => q.answers?.includes(c))) ng(qid, '候補に正解が 1 つもありません');
        }
        if (q.output !== undefined && !isNonEmptyString(q.output)) ng(qid, 'output は空でない文字列にします');
        if (q.wrongNotes !== undefined) {
          if (typeof q.wrongNotes !== 'object' || q.wrongNotes === null || Array.isArray(q.wrongNotes)) {
            ng(qid, 'wrongNotes は「候補: 説明」のオブジェクトにします');
          } else {
            for (const [key, note] of Object.entries(q.wrongNotes)) {
              if (!isNonEmptyString(note)) ng(qid, `wrongNotes.${key} は空でない文字列にします`);
              if (q.answers?.includes(key)) ng(qid, `wrongNotes に正解 (${key}) の説明があります`);
            }
          }
        }
      } else if (q?.type === 'choice') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) ng(qid, 'choices は 2 つ以上要ります');
        const ids = (q.choices ?? []).map((c) => c?.id);
        if (new Set(ids).size !== ids.length) ng(qid, '選択肢の id が重複しています');
        for (const [ci, c] of (q.choices ?? []).entries()) {
          if (!isNonEmptyString(c?.id) || !isNonEmptyString(c?.text)) ng(qid, `choices[${ci}] に id か text がありません`);
          if (c?.why !== undefined && !isNonEmptyString(c.why)) ng(qid, `choices[${ci}].why は空でない文字列にします`);
        }
        if (!ids.includes(q.answer)) ng(qid, `正解 (${q.answer}) が選択肢にありません`);
        if (q.fixedOrder !== undefined && typeof q.fixedOrder !== 'boolean') ng(qid, 'fixedOrder は true か false にします');
        if (q.code !== undefined && (!isNonEmptyString(q.code?.text) || !isNonEmptyString(q.code?.language))) {
          ng(qid, 'code は language と text を持ちます');
        }
      } else {
        ng(qid, `type は fill か choice にします (${q?.type})`);
      }
    }
  }

  if (errors.length) {
    failed = true;
    for (const line of errors) console.log(line);
  } else {
    console.log(`OK ${name}`);
  }
}

process.exit(failed ? 1 : 0);
