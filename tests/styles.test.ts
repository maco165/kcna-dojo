import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 規則の中に別の規則が入り込んでいないか (CSS のぶつかりを解き損ねたときに起きる)。@media などの中の規則は許す。
 * コメントと文字列は読み飛ばし、規則の頭 (前の { } ; から次の { まで) が @ で始まるかで at 規則を見分ける
 */
export function cssProblems(css: string): string[] {
  const problems: string[] = [];
  css.split('\n').forEach((raw, i) => {
    if (/^(<{7}|\|{7}|={7}|>{7})/.test(raw.replace(/\r$/, ''))) problems.push(`${i + 1} 行目: ぶつかりの印が残っています`);
  });
  const stack: ('at' | 'rule')[] = [];
  let line = 1;
  let prelude = '';
  for (let k = 0; k < css.length; k++) {
    const ch = css[k];
    if (ch === '\n') line++;
    if (ch === '/' && css[k + 1] === '*') {
      const end = css.indexOf('*/', k + 2);
      const stop = end === -1 ? css.length : end + 2;
      line += (css.slice(k, stop).match(/\n/g) ?? []).length;
      k = stop - 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let m = k + 1;
      while (m < css.length && css[m] !== ch) m += css[m] === '\\' ? 2 : 1;
      k = m;
      continue;
    }
    if (ch === '{') {
      if (stack[stack.length - 1] === 'rule') problems.push(`${line} 行目: 規則の中に規則が始まっています (${prelude.trim()})`);
      stack.push(prelude.trim().startsWith('@') ? 'at' : 'rule');
      prelude = '';
    } else if (ch === '}') {
      if (stack.length === 0) problems.push(`${line} 行目: 閉じかっこが多すぎます`);
      stack.pop();
      prelude = '';
    } else if (ch === ';') prelude = '';
    else prelude += ch;
  }
  if (stack.length > 0) problems.push(`閉じていない規則が ${stack.length} 個あります`);
  return problems;
}

describe('styles.css の形', () => {
  it('規則の中に規則が入り込まず、かっこが釣り合う', () => {
    expect(cssProblems(readFileSync(path.resolve(process.cwd(), 'src/styles.css'), 'utf8'))).toEqual([]);
  });
  it('検査は、閉じ忘れた規則と、ぶつかりの印を見つける', () => {
    expect(cssProblems('.a {\n  color: red;\n.b {\n  color: blue;\n}\n').length).toBeGreaterThan(0);
    expect(cssProblems('.a {}\n=======\n')).toContain('2 行目: ぶつかりの印が残っています');
    expect(cssProblems('@media (min-width: 1px) {\n  .a {\n    color: red;\n  }\n}\n')).toEqual([]);
    // 正しい CSS を誤って落とさない: 文字列の中のかっこ・複数行の @media・次の行の {・1 行の入れ子
    expect(cssProblems('.a::after { content: "}"; }\n.b::before { content: "{"; }\n')).toEqual([]);
    expect(cssProblems('@media (min-width: 1px)\n  and (max-width: 2px) {\n  .a { color: red; }\n}\n')).toEqual([]);
    expect(cssProblems('@media (min-width: 1px)\n{\n  .a { color: red; }\n}\n')).toEqual([]);
    expect(cssProblems('@media (x) { .a { .b {} } }')).toHaveLength(1);
    expect(cssProblems('.a {}\r\n=======\r\n|||||||\n').length).toBe(2);
  });
});
