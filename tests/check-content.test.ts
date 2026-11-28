import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error 検査の規則は JS
import { privateWords } from '../scripts/private-words.mjs';

const SCRIPT = join(__dirname, '../scripts/check-content.mjs');
const CHAPTER = join(__dirname, 'fixtures/hands-on/sample.json');
const WEEK1 = join(__dirname, '../src/content/week1.json');

function run(...args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}

function mutate(name: string, fn: (d: any) => void, sub?: string, from = WEEK1): string {
  const data = JSON.parse(readFileSync(from, 'utf8'));
  fn(data);
  const dir = join(mkdtempSync(join(tmpdir(), 'kcna-content-')), sub ?? '');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(data));
  return file;
}

// node を何度も起こすので、重い機械や CI でも落ちないよう 1 件 30 秒まで待つ
describe('check-content', { timeout: 30_000 }, () => {
  it('本物のデータは OK', () => {
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK');
  });

  it('実習は、分かること・用意するものと、打つ手順ごとの「うまくいくと」が無いと落ちる', () => {
    const lab = (d: any) => d.lessons.find((l: any) => l.kind === 'lab');
    expect(run(mutate('week1', (d) => delete lab(d).goal)).out).toMatch(/goal/);
    expect(run(mutate('week1', (d) => (lab(d).needs = []))).out).toMatch(/needs/);
    const noExpect = run(mutate('week1', (d) => delete lab(d).steps.find((s: any) => s.command).expect));
    expect(noExpect.code).not.toBe(0);
    expect(noExpect.out).toMatch(/expect/);
    expect(run(mutate('week1', (d) => (lab(d).steps[0].stuck = ''))).out).toMatch(/stuck/);
  });

  it('模擬試験用のファイル (exam/ の下) は week 0 で、x- の quiz と x- の問題だけを許す', () => {
    const toExam = (d: any) => {
      d.week = 0;
      // 模擬試験用のファイルは細目を持たない
      d.lessons = d.lessons.filter((l: any) => l.kind === 'quiz').slice(0, 1).map(({ competency: _c, ...l }: any) => ({ ...l, id: 'x-t', questions: l.questions.map((q: any, i: number) => ({ ...q, id: `x-t-${i}` })) }));
    };
    expect(run(mutate('exam-ok', toExam, 'exam')).code).toBe(0);
    const notQuiz = run(mutate('exam-ng', (d) => (d.week = 0), 'exam'));
    expect(notQuiz.code).toBe(1);
    expect(notQuiz.out).toContain('x- で始まる quiz');
    const plainId = run(mutate('exam-id', (d) => { toExam(d); d.lessons[0].questions[0].id = 'plain-1'; }, 'exam'));
    expect(plainId.out).toContain('問題の id は x- で始めます');
    expect(run(mutate('exam-week', (d) => { toExam(d); d.week = 3; }, 'exam')).out).toContain('week を 0 にします');
    // 週のファイルは置き場所が exam/ でないので、week 0 は通さない
    expect(run(mutate('week-zero', toExam)).out).toContain('week は 1 以上');
    expect(run(mutate('week-neg', (d) => (d.week = -1))).code).toBe(1);
  });

  it('必須の欄を消すと NG (ファイル名と id を出す)', () => {
    for (const key of ['id', 'type', 'prompt', 'explanation', 'source']) {
      const file = mutate(`no-${key}`, (d) => {
        delete d.lessons[0].questions[1][key];
      });
      const r = run(file);
      expect(r.code, key).toBe(1);
      expect(r.out, key).toContain(`no-${key}.json`);
      expect(r.out, key).toContain('w1-l1');
    }
    const noAnswer = mutate('no-answers', (d) => {
      delete d.lessons[1].questions[0].answers;
    });
    expect(run(noAnswer).out).toContain('NG');
    expect(run(noAnswer).out).toContain('w1-l2-q1');
  });

  it('4 択の正解が選択肢に無いと NG', () => {
    const r = run(mutate('bad-answer', (d) => (d.lessons[0].questions[0].answer = 'z')));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/NG .*bad-answer\.json w1-l1-q1: 正解 \(z\) が選択肢にありません/);
  });

  it('問題 id が重複すると NG', () => {
    const r = run(mutate('dup-id', (d) => (d.lessons[1].questions[0].id = 'w1-l1-q1')));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/NG .*dup-id\.json w1-l1-q1: id が重複しています/);
  });

  it('穴埋めの空欄が 1 つでないと NG', () => {
    const r = run(mutate('two-blanks', (d) => (d.lessons[1].questions[0].code += ' {{blank}}')));
    expect(r.code).toBe(1);
    expect(r.out).toContain('w1-l2-q1');
  });

  it('任意の欄の型が違うと NG', () => {
    const cases: [string, (d: any) => void, string][] = [
      ['output-number', (d) => (d.lessons[1].questions[3].output = 1), 'w1-l2-q4'],
      ['wrongnotes-string', (d) => (d.lessons[1].questions[0].wrongNotes = 'x'), 'w1-l2-q1'],
      ['wrongnotes-value-number', (d) => (d.lessons[1].questions[0].wrongNotes.RUN = 1), 'w1-l2-q1'],
      ['why-number', (d) => (d.lessons[0].questions[0].choices[1].why = 1), 'w1-l1-q1'],
      ['dup-candidates', (d) => d.lessons[1].questions[0].candidates.push('COPY'), 'w1-l2-q1'],
      ['fixedorder-string', (d) => (d.lessons[0].questions[0].fixedOrder = 'yes'), 'w1-l1-q1'],
    ];
    for (const [name, fn, id] of cases) {
      const r = run(mutate(name, fn));
      expect(r.code, name).toBe(1);
      expect(r.out, name).toContain(id);
    }
  });

  it('週のレッスンは学習要領の細目を持つ。模擬試験用のファイルのレッスンは持たない', () => {
    expect(run(mutate('no-competency', (d) => delete d.lessons[0].competency)).out).toMatch(/w1-l1: competency が学習要領の細目のどれでもありません \(undefined\)/);
    expect(run(mutate('bad-competency', (d) => (d.lessons[0].competency = 'Containers'))).out).toMatch(/w1-l1: competency が.*\(Containers\)/);
    expect(run(mutate('bad-since', (d) => (d.lessons[0].since = '11-28'))).out).toMatch(/w1-l1: since .*YYYY-MM-DD/);
    expect(run(mutate('feb31-since', (d) => (d.lessons[0].since = '2026-02-31'))).out).toMatch(/w1-l1: since .*YYYY-MM-DD/);
    expect(run(mutate('ok-since', (d) => (d.lessons[0].since = '2026-11-28'))).code).toBe(0);
    const exam = run(mutate('exam-comp', (d) => { d.week = 0; d.lessons = d.lessons.filter((l: any) => l.kind === 'quiz').slice(0, 1).map((l: any) => ({ ...l, id: 'x-t', questions: l.questions.map((q: any, i: number) => ({ ...q, id: `x-t-${i}` })) })); }, 'exam'));
    expect(exam.out).toMatch(/competency を書きません/);
  });

  it('5 問に満たないレッスンは NG', () => {
    const r = run(mutate('three-questions', (d) => (d.lessons[0].questions = d.lessons[0].questions.slice(0, 3))));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/w1-l1: questions は 5 問以上要ります \(3 問\)/);
  });
});

describe('check-content: 実践の章', { timeout: 120_000 }, () => {
  const chapter = (name: string, fn: (d: any) => void) => mutate(name, fn, 'hands-on', CHAPTER);
  /** code のある手順 (見本の 4 つ目) */
  const step = (d: any) => d.steps[3];

  it('全部の欄を持つ見本は OK', () => {
    const r = run(CHAPTER);
    expect(r.out).toContain('OK');
    expect(r.code).toBe(0);
  });

  // [名前, 変異, 出るはずの理由]
  const cases: [string, (d: any) => void, RegExp][] = [
    ...['id', 'title', 'summary', 'goal', 'features', 'minutes', 'needs', 'reads', 'steps', 'cleanup', 'challenges', 'sources', 'order'].map((k): [string, (d: any) => void, RegExp] => [`章の ${k} が無い`, (d) => delete d[k], new RegExp(k)]),
    ...['id', 'text', 'why', 'lines', 'output', 'read', 'trouble', 'source'].map((k): [string, (d: any) => void, RegExp] => [`手順の ${k} が無い`, (d) => delete step(d)[k], new RegExp(`steps\\[3\\].*${k}`)]),
    ...['symptom', 'check', 'fix'].map((k): [string, (d: any) => void, RegExp] => [`trouble の ${k} が無い`, (d) => delete step(d).trouble[0][k], new RegExp(`trouble\\[0\\] に ${k}`)]),
    ...['task', 'hint', 'answer', 'verify'].map((k): [string, (d: any) => void, RegExp] => [`課題の ${k} が無い`, (d) => delete d.challenges[0][k], new RegExp(`challenges\\[0\\] に ${k}`)]),
    ['trouble が 0 件', (d) => (step(d).trouble = []), /trouble/],
    ['code の文が無い', (d) => delete step(d).code.text, /code は language/],
    ['知らない言語', (d) => (step(d).code.language = 'ruby'), /code は language/],
    ['lines が 1 行足りない', (d) => step(d).lines.pop(), /lines は code の全部の行/],
    ['lines の並びが違う', (d) => step(d).lines.reverse(), /lines は code の全部の行/],
    ['lines に意味が無い', (d) => (step(d).lines[0].text = ''), /lines は code の全部の行/],
    ['手順の id が重複', (d) => (d.cleanup[0].id = d.steps[0].id), /id check-memory が章の中で重複/],
    ['手順の出典が http', (d) => (step(d).source = 'http://example.com/'), /source/],
    ['章の出典が http', (d) => (d.sources[0].url = 'http://example.com/'), /sources\[0\]/],
    ['無いトピック', (d) => (d.reads[0].topic = 'no-such'), /no-such というハンドブックのトピックはありません/],
    ['知らない OS', (d) => (step(d).os = 'bsd'), /os は/],
    ['知らない端末', (d) => (step(d).where = 'cloud'), /where は/],
    ['空の unverified では output を省けない', (d) => { delete step(d).output; step(d).unverified = ' '; }, /unverified は空でない/],
    ['知らない欄 (つづりの間違い)', (d) => (step(d).outputs = 'x'), /outputs という欄は使いません/],
    ['code の無い手順に output', (d) => (d.steps[0].output = 'x'), /code のある手順にだけ/],
    ['Linux の人がする手順が無い', (d) => (d.steps = d.steps.filter((s: any) => s.os)), /linux の人がする手順/],
    ['output と unverified の両方', (d) => (step(d).unverified = '未確認'), /両方持てません/],
    ['家のネットワークの住所', (d) => (step(d).output = '192.168.0.5'), /載せてはいけない.*192\.168/],
    ['家のクラスタの名前', (d) => (d.challenges[0].answer = 'ssh slave-1'), /載せてはいけない.*slave-1/],
    ['Linux のログイン名', (d) => (step(d).output = '/home/taro/.kube'), /載せてはいけない.*\/home\/taro/],
    ['Mac のログイン名', (d) => (step(d).lines[0].text = '/Users/taro を見る'), /載せてはいけない.*\/Users\/taro/],
    ['Windows のログイン名', (d) => (step(d).output = 'PS C:\\Users\\taro>'), /載せてはいけない.*Users/],
    ['端末の行頭の利用者名', (d) => (step(d).output = 'taro@kcna:~$ id -u'), /載せてはいけない.*taro@kcna/],
    ['端末の行頭のホスト名', (d) => (step(d).output = 'ubuntu@mypc:~$ id -u\n1000'), /載せてはいけない.*ubuntu@mypc/],
    ['長い題名に short が無い', (d) => (d.title = 'あ'.repeat(36)), /short/],
    ['後片付けの手順も同じ検査', (d) => (d.cleanup[0].code = { language: 'bash', text: 'exit' }), /cleanup\[0\].*lines/],
  ];
  it.each(cases)('%s と NG', (_, fn, why) => {
    const r = run(chapter('broken', fn));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(why);
  });

  it('章の仮想マシンの名前は通し、走らせている端末の名前は落とす', () => {
    expect(run(chapter('vm', (d) => (step(d).output = 'ubuntu@kcna:~$ id -u\n1000\n/home/ubuntu\nroot@kcna:~# macOS'))).code).toBe(0);
    expect(privateWords('node-Taro-pc ready', ['taro-pc'])).toHaveLength(1);
    expect(privateWords('macOS と maco165', ['maco'])).toEqual([]);
  });

  it('unverified があれば output を省ける', () => {
    const file = chapter('unverified', (d) => { delete step(d).output; step(d).unverified = '実機では確かめていません'; });
    expect(run(file)).toMatchObject({ code: 0 });
  });

  it('章の id と番号は、ほかの章と重ねない', () => {
    const r = run(CHAPTER, chapter('same', () => {}));
    expect(r.out).toMatch(/sample: id が重複しています/);
    expect(r.out).toMatch(/order 0 が重複しています/);
    expect(run(CHAPTER, chapter('other', (d) => { d.id = 'other'; d.order = 1; })).code).toBe(0);
  });
});
