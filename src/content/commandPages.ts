// コマンドのページ (/commands/<id>/) のデータ。何をするか・書き方・オプションは commands.json (答えたあとの「出てきたコマンド」と共通)、
// 中で何が起きるか・API の要求・実行の例・-v で見える要求・実装の抜粋は commandPages/*.json。どちらも公式の文書・実装で確かめて書く
import commands from './commands.json';
import setup from './setupCommands.json';
import type { CommandData, CommandEntry, CommandFlag } from '../lib/commandRefs';

export type CommandPageExtra = {
  id: string;
  /** ページの題名 (<title>) に使う短い名前。title が長くて題名が 35 字を超えるときだけ持つ (src/lib/pageTitle.ts の withSite) */
  short?: string;
  /** 打ってから結果が出るまでに中で起きること (段ごとの文) */
  inside: string[];
  /** 送る API の要求 (Kubernetes の API を呼ばない道具は空) */
  api: { method: string; path: string; note?: string }[];
  /** 実行の例と出力の例 */
  examples: { title: string; code: string; output?: string; note?: string }[];
  /** kubectl -v で見える要求 */
  verbose?: { code: string; output: string; note?: string };
  /** 実装の該当箇所 (版のタグつき) */
  impl?: { repo: string; ref: string; path: string; lines?: string; excerpt: string; note?: string };
  sources: { label: string; url: string }[];
};

export type CommandPage = CommandEntry & CommandPageExtra & { tool: string; globalFlags: CommandFlag[]; /** 問題には出ず、ハンドブックの k3s の入れ方で使う */ setup?: boolean };

const DATA = commands as CommandData;
const FILES = import.meta.glob<CommandPageExtra[]>('./commandPages/*.json', { eager: true, import: 'default' });
const EXTRA = new Map(
  Object.keys(FILES)
    .sort()
    .flatMap((k) => FILES[k])
    .map((p) => [p.id, p]),
);

const globalFlags = (tool: string) => DATA.tools.find((t) => t.tool === tool)?.globalFlags ?? [];

/** ページのあるコマンド (説明と中身の両方がそろったもの)。道具ごと・書いた順。問題に出ないもの (setupCommands.json) は後ろに置く */
export const COMMAND_PAGES: CommandPage[] = [
  ...DATA.commands.flatMap((c) => {
    const extra = EXTRA.get(c.id);
    if (!extra) return [];
    const tool = c.command.split(' ')[0];
    return [{ ...c, ...extra, tool, globalFlags: globalFlags(tool) }];
  }),
  ...(setup as (CommandEntry & CommandPageExtra & { tool: string })[]).map((c) => ({ ...c, globalFlags: globalFlags(c.tool), setup: true })),
];

export const findCommandPage = (id: string) => COMMAND_PAGES.find((p) => p.id === id);

/** ページの短い題名 (画面・書き出す HTML で共通)。見出しと同じコマンドの名前にする (ページごとに違う題名にするため) */
export const commandPageTitle = (id: string) => {
  const c = findCommandPage(id);
  return c ? (c.short ?? c.command) : 'コマンド';
};

/** 一覧の段の順 (道具) */
export const TOOL_ORDER = ['kubectl', 'helm', 'docker', 'k3s', 'etcdctl', 'curl', 'nslookup', 'Linux'];

/** 実装の該当箇所の URL (版のタグと行つき) */
export const implUrl = (impl: NonNullable<CommandPageExtra['impl']>) => `https://github.com/${impl.repo}/blob/${impl.ref}/${impl.path}${impl.lines ? `#${impl.lines}` : ''}`;
