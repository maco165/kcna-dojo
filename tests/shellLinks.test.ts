import { describe, expect, it } from 'vitest';
import { COMMAND_BRIEFS } from '../src/content/commandBriefs';
import { COMMAND_PAGES, findCommandPage } from '../src/content/commandPages';
import { HANDBOOK, findTopic } from '../src/content/handbook';
import { CURRICULUM } from '../src/content/guide';
import { WEEKS } from '../src/content/curriculum';
import { validateHandbook } from '../src/lib/handbook';
import { linkShell } from '../src/lib/shellLinks';

const ids = (line: string) => linkShell(line, COMMAND_BRIEFS).pieces.flatMap((p) => (typeof p === 'string' ? [] : [p.id]));
const steps = (t: NonNullable<ReturnType<typeof findTopic>>['topic']) => [...t.flow, ...t.try.flatMap((x) => x.steps)];

describe('コマンドの行の中のコマンドをページへつなぐ', () => {
  it('パイプ・sudo・$( ) の後ろと、道の付いた名前も見つける', () => {
    expect(ids('curl -sfL https://get.k3s.io | sh -')).toEqual(['curl', 'sh']);
    expect(ids('sudo chown "$(id -u):$(id -g)" f')).toEqual(['sudo', 'chown', 'id', 'id']);
    expect(ids('/usr/local/bin/k3s-uninstall.sh')).toEqual(['k3s-uninstall']);
    expect(ids('kubectl create namespace x && mkdir -p a')).toEqual(['kubectl-create-namespace', 'mkdir']);
  });
  it('引数や引用符の中は拾わず、知らないコマンドは知らせる', () => {
    expect(ids("echo 'export A=1; cp a b' >> f")).toEqual(['echo']);
    expect(ids('cp sh id')).toEqual(['cp']);
    expect(linkShell('cpx a', COMMAND_BRIEFS).unknown).toEqual(['cpx']);
  });
  it('k3s の入れ方の全部のコマンドに、1 行ずつの意味とページがある', () => {
    const bash = steps(findTopic('setup-k3s')!.topic).filter((s) => s.code?.language === 'bash');
    expect(bash.length).toBeGreaterThanOrEqual(8);
    for (const s of bash) {
      expect(s.lines, s.code!.text).toBeDefined();
      for (const l of s.lines!) {
        const { pieces, unknown } = linkShell(l.code, COMMAND_BRIEFS);
        expect(unknown, l.code).toEqual([]);
        expect(pieces.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(l.code);
        for (const p of pieces) if (typeof p !== 'string') expect(findCommandPage(p.id), p.id).toBeDefined();
      }
    }
  });
  it('意味の行が抜けたら検査が落とす', () => {
    const data = structuredClone(HANDBOOK);
    const t = data.flatMap((d) => d.topics).find((x) => x.id === 'setup-k3s')!;
    t.flow.find((s) => (s.lines?.length ?? 0) > 1)!.lines!.pop();
    const domains = new Map(CURRICULUM.map((c) => [c.domain as string, c.competencies.map((x) => x.en)]));
    const lessonIds = new Set(WEEKS.flatMap((w) => (w.content?.lessons ?? []).map((l) => l.id)));
    expect(validateHandbook(data, domains, lessonIds).join()).toMatch(/lines は bash のコードの全部の行/);
  });
  it('ハンドブックだけのコマンドも、id と名前が重ならず、どれも手順で使われる', () => {
    expect(new Set(COMMAND_PAGES.map((p) => p.id)).size).toBe(COMMAND_PAGES.length);
    expect(new Set(COMMAND_PAGES.map((p) => p.command)).size).toBe(COMMAND_PAGES.length);
    const used = new Set(steps(findTopic('setup-k3s')!.topic).flatMap((s) => (s.lines ?? []).flatMap((l) => ids(l.code))));
    expect(COMMAND_PAGES.filter((p) => p.setup && !used.has(p.id)).map((p) => p.id)).toEqual([]);
  });
});
