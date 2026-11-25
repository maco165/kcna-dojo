// ハンドブックの「コマンドの意味」で使う: コードを 1 行ずつのコマンドに分け、行の中のコマンドの名前 (sudo・cp・
// kubectl create namespace など) を見つけて、コマンドのページへのリンクにする
export type ShellPiece = string | { text: string; id: string };
export type CommandBrief = { id: string; command: string; summary: string };

/** 引用符の外の、行末のコメント (空白の後ろの #) を落とす */
function dropComment(line: string): string {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) quote = ch === quote ? '' : quote;
    else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/** コードを、打つコマンドの行に分ける。コメントと空の行、ヒアドキュメント (<<EOF) の中身は除く */
export function commandRows(code: string): string[] {
  const out: string[] = [];
  let end: string | null = null;
  for (const raw of code.split('\n')) {
    if (end !== null) {
      if (raw.trim() === end) end = null;
      continue;
    }
    const line = dropComment(raw).trim();
    if (!line) continue;
    out.push(line);
    end = line.match(/<<-?\s*['"]?(\w+)['"]?/)?.[1] ?? null;
  }
  return out;
}

/** 行を切り分ける。見つからなかったコマンドの名前は unknown に入れる (検査で落とす) */
export function linkShell(line: string, commands: CommandBrief[]): { pieces: ShellPiece[]; unknown: string[] } {
  // 長い名前を先に試す (kubectl create namespace を kubectl より先に)
  const names = [...commands].sort((a, b) => b.command.length - a.command.length);
  const pieces: ShellPiece[] = [];
  const unknown: string[] = [];
  let plain = '';
  let i = 0;
  // コマンドの名前が来る所か (行の頭・| & ; $( ` の後ろ・sudo の後ろ)
  let head = true;
  // いま二重引用符の中か ($( ) に入るたびに積む。中の | や ; は文字だが、$( ) の中はコマンド)
  const inDouble: boolean[] = [false];
  while (i < line.length) {
    const rest = line.slice(i);
    if (head && /^\s/.test(rest)) {
      plain += rest[0];
      i += 1;
      continue;
    }
    if (head) {
      head = false;
      const dir = rest.match(/^\/(?:[\w.-]+\/)*/)?.[0] ?? '';
      const at = rest.slice(dir.length);
      const hit = names.find((c) => at.startsWith(c.command) && !/[\w./-]/.test(at.charAt(c.command.length)));
      if (hit) {
        if (plain + dir) pieces.push(plain + dir);
        plain = '';
        pieces.push({ text: hit.command, id: hit.id });
        i += dir.length + hit.command.length;
        head = hit.command === 'sudo';
        continue;
      }
      unknown.push(rest.split(/[\s|;)&]/)[0]);
    }
    const dq = inDouble[inDouble.length - 1];
    let take = rest[0];
    if (rest.startsWith('$(') || rest[0] === '`') {
      take = rest[0] === '`' ? '`' : '$(';
      if (take === '$(') inDouble.push(false);
      head = true;
    } else if (rest[0] === '"') inDouble[inDouble.length - 1] = !dq;
    else if (!dq) {
      take = rest.match(/^'[^']*'/)?.[0] ?? rest.match(/^(?:\|\|?|&&?|;)/)?.[0] ?? rest[0];
      if (/^[|&;]/.test(take) && !/>$/.test(plain)) head = true;
      else if (take === ')' && inDouble.length > 1) inDouble.pop();
    }
    plain += take;
    i += take.length;
  }
  if (plain) pieces.push(plain);
  return { pieces, unknown };
}
