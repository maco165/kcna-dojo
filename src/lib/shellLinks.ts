// 1 行のコマンドの中から、動かすコマンドの名前 (sudo・cp・kubectl create namespace など) を見つける。
// ハンドブックの「コマンドの意味」で、名前をコマンドのページへのリンクにするために使う
export type ShellPiece = string | { text: string; id: string };
export type CommandBrief = { id: string; command: string; summary: string };

/** 行を切り分ける。見つからなかったコマンドの名前は unknown に入れる (検査で落とす) */
export function linkShell(line: string, commands: CommandBrief[]): { pieces: ShellPiece[]; unknown: string[] } {
  // 長い名前を先に試す (kubectl create namespace を kubectl より先に)
  const names = [...commands].sort((a, b) => b.command.length - a.command.length);
  const pieces: ShellPiece[] = [];
  const unknown: string[] = [];
  let plain = '';
  let i = 0;
  // コマンドの名前が来る所か (行の頭・| && ; $( の後ろ・sudo の後ろ)
  let head = true;
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
      const hit = names.find((c) => at.startsWith(c.command) && !/[\w.-]/.test(at.charAt(c.command.length)));
      if (hit) {
        if (plain + dir) pieces.push(plain + dir);
        plain = '';
        pieces.push({ text: hit.command, id: hit.id });
        i += dir.length + hit.command.length;
        head = hit.command === 'sudo';
        continue;
      }
      unknown.push(rest.split(/[\s|;)]/)[0]);
    }
    const quoted = rest.match(/^'[^']*'/)?.[0];
    const sep = rest.match(/^(?:\|\|?|&&|;|\$\()/)?.[0];
    if (sep) head = true;
    const take = quoted ?? sep ?? rest[0];
    plain += take;
    i += take.length;
  }
  if (plain) pieces.push(plain);
  return { pieces, unknown };
}
