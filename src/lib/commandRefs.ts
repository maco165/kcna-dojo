// 問題に出てくるコマンドを見つけ、説明のデータ (src/content/commands.json) と結び付ける。
// 答えたあとの解説の下に「出てきたコマンド」として出す
import type { Question } from '../content/types';

/** absent: そのコマンドに無い指定 (誤りの選択肢に出てくるもの)。「無い指定」として別に出す */
export type CommandFlag = { flags: string[]; text: string; absent?: boolean };
export type CommandEntry = {
  id: string;
  /** 道具とサブコマンド (例: "kubectl rollout undo") */
  command: string;
  /** 何をするか (1 文) */
  summary: string;
  /** 少し詳しく (何が出るか・いつ使うか。1〜3 文) */
  detail?: string;
  /** 書き方 (例: "kubectl get <種類> [名前] [オプション]") */
  usage: string;
  /** このコマンドのオプションのうち、問題に出てくるもの */
  flags?: CommandFlag[];
  /** 公式リファレンスのページ */
  source: string;
  /** リファレンスに無いことを補う出典 (概念のページ・実装など) */
  refs?: { label: string; url: string }[];
  /** 無いコマンド (誤りの選択肢に出てくる kubectl helm など)。ページは作らず「無いコマンド」として出す */
  absent?: boolean;
};
/** 道具ごとの、どのサブコマンドにも付けられるオプション (kubectl の -n など) */
export type ToolEntry = { tool: string; globalFlags: CommandFlag[]; source: string };
export type CommandData = { tools: ToolEntry[]; commands: CommandEntry[] };

/** 説明を付ける道具 (この語で始まるところをコマンドとして読む) */
export const TOOLS = ['kubectl', 'helm', 'docker', 'crictl', 'k3s', 'ctr', 'etcdctl', 'argocd', 'flux', 'kustomize', 'nslookup', 'curl'] as const;

/** 1 つの出現: どの説明に当たり、どのオプションを使っているか */
export type CommandUse = { entry: CommandEntry; flags: CommandFlag[] };
/** 説明のデータに無かったもの (検査で使う) */
export type Unknown = { line: string; reason: 'command' | 'flag'; token: string };

// 前は空白・記号・日本語の句読点を許し (「…ので、kubectl logs」)、後ろはパイプと日本語の文の手前まで (同じ行の 2 つ目の道具も拾う)
const TOOL_RE = new RegExp(`(?:^|[\\s\`$(「、。・])(${TOOLS.join('|')})\\s+([^\\n\`」、。（）|\u3041-\u3093\u30a1-\u30f6\u4e00-\u9fa0]*)`, 'g');
/** コマンドの行の終わり (パイプ・つなぎ・日本語の文が始まるところ) */
const LINE_END = /\s(?:\||&&|;)\s|[ぁ-んァ-ヶ一-龠]/;

/** 問題の中の文 (問題文・コード・選択肢)。穴埋めの空欄は正解で埋める (答えたあとにだけ出すので) */
export function questionTexts(q: Question): string[] {
  const out = [q.prompt];
  if (q.type === 'fill') out.push(q.code.replace('{{blank}}', q.answers[0]));
  else {
    if (q.code) out.push(q.code.text);
    for (const c of q.choices) out.push(c.text);
  }
  return out;
}

/** 文の中のコマンドの出現 (道具の名前と、その後ろの語) */
export function commandLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(TOOL_RE)) {
      const rest = m[2].split(LINE_END)[0].trim();
      // 「kubectl → kube-apiserver」のような矢印や、語の無いものはコマンドとして読まない
      if (!rest || !/^[a-z-]/.test(rest)) continue;
      out.push(`${m[1]} ${rest}`);
    }
  }
  return out;
}

/** 1 行のコマンドを、説明のデータに当てる。サブコマンドはいちばん長く一致するもの */
export function matchLine(line: string, data: CommandData): { use?: CommandUse; unknown: Unknown[] } {
  // -- より後ろはコンテナの中で動かすコマンドなので読まない。語の終わりの閉じかっこは落とす (「(kubectl logs --previous)」など)
  const all = line.split(/\s+/).map((w) => w.replace(/[)）」]+$/, ''));
  const end = all.indexOf('--');
  const words = end === -1 ? all : all.slice(0, end);
  const tool = words[0];
  // サブコマンドの語を読む。前に置いたオプション (etcdctl --endpoints $X snapshot save、kubectl -n ns get) は値ごと飛ばす
  const plain: string[] = [tool];
  let skipValue = false;
  for (const w of words.slice(1)) {
    if (w.startsWith('-')) {
      skipValue = !w.includes('=');
      continue;
    }
    if (skipValue) {
      skipValue = false;
      continue;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(w)) break;
    plain.push(w);
  }
  let entry: CommandEntry | undefined;
  for (let n = plain.length; n >= 1 && !entry; n--) {
    const name = plain.slice(0, n).join(' ');
    entry = data.commands.find((c) => c.command === name);
  }
  if (!entry) return { unknown: [{ line, reason: 'command', token: plain.slice(0, 2).join(' ') }] };
  const global = data.tools.find((t) => t.tool === tool)?.globalFlags ?? [];
  const flags: CommandFlag[] = [];
  const unknown: Unknown[] = [];
  for (const w of words) {
    if (!/^--?[a-zA-Z]/.test(w)) continue;
    const name = w.split('=')[0];
    const f = [...(entry.flags ?? []), ...global].find((x) => x.flags.includes(name));
    if (!f) unknown.push({ line, reason: 'flag', token: `${entry.command} ${name}` });
    else if (!flags.includes(f)) flags.push(f);
  }
  return { use: { entry, flags }, unknown };
}

/** 問題に出てくるコマンド (同じコマンドは 1 つにまとめ、使っているオプションを合わせる) */
export function commandUses(q: Question, data: CommandData): CommandUse[] {
  const byId = new Map<string, CommandUse>();
  for (const line of questionTexts(q).flatMap(commandLines)) {
    const { use } = matchLine(line, data);
    if (!use) continue;
    const had = byId.get(use.entry.id);
    if (!had) byId.set(use.entry.id, { entry: use.entry, flags: [...use.flags] });
    else for (const f of use.flags) if (!had.flags.includes(f)) had.flags.push(f);
  }
  return [...byId.values()];
}

/** 説明のデータに無いコマンドとオプション (検査で使う) */
export function unknownCommands(q: Question, data: CommandData): Unknown[] {
  return questionTexts(q)
    .flatMap(commandLines)
    .flatMap((line) => matchLine(line, data).unknown);
}
