#!/usr/bin/env node
// 問題データ (src/content/week*.json) の検査。src/content/types.ts と同じ欄を見る。
// 使い方: node scripts/check-content.mjs [ファイル ...]   (省略すると src/content/week*.json の全部)
// 通れば "OK <ファイル>" を出して終了コード 0。1 つでも違えば "NG <ファイル> <id>: <理由>" を出して終了コード 1。
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT_DIR = join(ROOT, 'src/content');
const DOMAINS = [
  'Kubernetes Fundamentals',
  'Container Orchestration',
  'Cloud Native Application Delivery',
  'Cloud Native Architecture',
];
const LANGUAGES = ['bash', 'yaml', 'dockerfile'];
const BLANK = '{{blank}}';

const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync(CONTENT_DIR)
      .filter((f) => /^week\d+\.json$/.test(f))
      .sort()
      .map((f) => join(CONTENT_DIR, f));

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

  if (!Number.isInteger(data.week) || data.week < 1) ng('-', 'week は 1 以上の整数にします');
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) ng('-', 'lessons がありません');

  for (const [li, lesson] of (data.lessons ?? []).entries()) {
    const lid = lesson?.id ?? `lessons[${li}]`;
    claimId(lesson?.id, `lessons[${li}]`);
    for (const key of ['title', 'summary']) if (!isNonEmptyString(lesson?.[key])) ng(lid, `${key} がありません`);
    if (!DOMAINS.includes(lesson?.domain)) ng(lid, `domain が試験の 4 分野のどれでもありません (${lesson?.domain})`);

    if (lesson?.kind === 'lab') {
      if (!isHttpsUrl(lesson.source)) ng(lid, 'source (出典の https の URL) がありません');
      if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) ng(lid, 'steps がありません');
      for (const [si, step] of (lesson.steps ?? []).entries()) {
        if (!isNonEmptyString(step?.text)) ng(lid, `steps[${si}] に text がありません`);
        if (step?.command !== undefined && !isNonEmptyString(step.command)) ng(lid, `steps[${si}] の command が空です`);
      }
      continue;
    }
    if (lesson?.kind !== 'quiz') {
      ng(lid, `kind は quiz か lab にします (${lesson?.kind})`);
      continue;
    }
    if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) ng(lid, 'questions がありません');

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
          else if (!q.candidates.some((c) => q.answers?.includes(c))) ng(qid, '候補に正解が 1 つもありません');
        }
        for (const key of Object.keys(q.wrongNotes ?? {})) {
          if (q.answers?.includes(key)) ng(qid, `wrongNotes に正解 (${key}) の説明があります`);
        }
      } else if (q?.type === 'choice') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) ng(qid, 'choices は 2 つ以上要ります');
        const ids = (q.choices ?? []).map((c) => c?.id);
        if (new Set(ids).size !== ids.length) ng(qid, '選択肢の id が重複しています');
        for (const [ci, c] of (q.choices ?? []).entries()) {
          if (!isNonEmptyString(c?.id) || !isNonEmptyString(c?.text)) ng(qid, `choices[${ci}] に id か text がありません`);
        }
        if (!ids.includes(q.answer)) ng(qid, `正解 (${q.answer}) が選択肢にありません`);
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
