// コマンドの id・名前・短い意味だけの一覧 (vite.config.ts の ?brief)。ハンドブックがコマンドのページの全文を読まないため
import type { CommandBrief } from '../lib/shellLinks';

const FILES = import.meta.glob<CommandBrief[]>(['./commands.json', './setupCommands.json'], { query: '?brief', eager: true, import: 'default' });
export const COMMAND_BRIEFS: CommandBrief[] = Object.keys(FILES)
  .sort()
  .flatMap((k) => FILES[k]);
