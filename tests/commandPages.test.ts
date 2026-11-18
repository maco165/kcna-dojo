import { describe, expect, it } from 'vitest';
import commands from '../src/content/commands.json';
import { COMMAND_PAGES, findCommandPage, implUrl } from '../src/content/commandPages';
import { commandsHref, parseRoute } from '../src/lib/route';
import type { CommandData } from '../src/lib/commandRefs';

const DATA = commands as CommandData;
/** 家のクラスタの名前・住所が載っていないか (載せるなら伏せる決まり) */
const PRIVATE = /192\.168\.|slave-\d|pihole|keycloak|household|k3s-home|\/home\/maco/;

describe('コマンドのページ', () => {
  it('問題に出てくるコマンドのすべてにページがある (無いコマンドを除く)', () => {
    // 無いコマンド (誤りの選択肢の kubectl helm など) にはページを作らない
    const missing = DATA.commands.filter((c) => !c.absent).map((c) => c.id).filter((id) => !findCommandPage(id));
    expect(missing).toEqual([]);
  });
  it('中で何が起きるかと実行の例があり、出典と実装の URL は https', () => {
    for (const p of COMMAND_PAGES) {
      expect(p.inside.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.examples.length, p.id).toBeGreaterThanOrEqual(1);
      for (const s of p.sources) expect(new URL(s.url).protocol, `${p.id} ${s.url}`).toBe('https:');
      if (p.impl) {
        expect(implUrl(p.impl).startsWith('https://github.com/'), p.id).toBe(true);
        expect(p.impl.excerpt.split('\n').length, `${p.id} の抜粋は 20 行まで`).toBeLessThanOrEqual(21);
      }
      for (const a of p.api) expect(a.path.startsWith('/'), `${p.id} ${a.path}`).toBe(true);
    }
  });
  it('家のクラスタの名前・住所を載せていない', () => {
    for (const p of COMMAND_PAGES) expect(JSON.stringify(p).match(PRIVATE)?.[0], p.id).toBeUndefined();
  });
  it('経路: /commands/ は一覧、/commands/<id>/ はページ', () => {
    expect(parseRoute(commandsHref())).toEqual({ name: 'commands' });
    expect(parseRoute(commandsHref('kubectl-get'))).toEqual({ name: 'commands', commandId: 'kubectl-get' });
  });
});
