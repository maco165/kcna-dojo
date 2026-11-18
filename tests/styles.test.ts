import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** 規則の中に別の規則が入り込んでいないか (CSS のぶつかりを解き損ねたときに起きる)。@media などの中の規則は許す */
export function cssProblems(css: string): string[] {
  const problems: string[] = [];
  const stack: ('at' | 'rule')[] = [];
  css
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split('\n')
    .forEach((line, i) => {
      for (const ch of line) {
        if (ch === '{') {
          const at = /^\s*@/.test(line);
          if (stack[stack.length - 1] === 'rule') problems.push(`${i + 1} 行目: 規則の中に規則が始まっています (${line.trim()})`);
          stack.push(at ? 'at' : 'rule');
        } else if (ch === '}') {
          if (stack.length === 0) problems.push(`${i + 1} 行目: 閉じかっこが多すぎます`);
          stack.pop();
        }
      }
      if (/^<{7}|^={7}$|^>{7}/.test(line)) problems.push(`${i + 1} 行目: ぶつかりの印が残っています`);
    });
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
  });
});
