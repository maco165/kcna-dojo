import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '../scripts/check-content.mjs');
const WEEK1 = join(__dirname, '../src/content/week1.json');

function run(file?: string): { code: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT, ...(file ? [file] : [])], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}

function mutate(name: string, fn: (d: any) => void): string {
  const data = JSON.parse(readFileSync(WEEK1, 'utf8'));
  fn(data);
  const dir = mkdtempSync(join(tmpdir(), 'kcna-content-'));
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(data));
  return file;
}

describe('check-content', () => {
  it('本物のデータは OK', () => {
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK');
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
    ];
    for (const [name, fn, id] of cases) {
      const r = run(mutate(name, fn));
      expect(r.code, name).toBe(1);
      expect(r.out, name).toContain(id);
    }
  });

  it('5 問に満たないレッスンは NG', () => {
    const r = run(mutate('three-questions', (d) => (d.lessons[0].questions = d.lessons[0].questions.slice(0, 3))));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/w1-l1: questions は 5 問以上要ります \(3 問\)/);
  });
});
