import { describe, expect, it } from 'vitest';
import handbookCommands from '../src/content/handbookCommands.json';
import { COMMAND_BRIEFS } from '../src/content/commandBriefs';
import { COMMAND_PAGES, findCommandPage } from '../src/content/commandPages';
import { HANDBOOK_TOPICS, findTopic } from '../src/content/handbook';
import { LINE_NOTES, LINE_NOTE_TOPICS, lineNotes, topicLineNotes } from '../src/content/lineNotes';
import { commandRows, linkShell } from '../src/lib/shellLinks';

const ids = (line: string) => linkShell(line, COMMAND_BRIEFS).pieces.flatMap((p) => (typeof p === 'string' ? [] : [p.id]));
/** 問題に出ず、ハンドブックだけで使うコマンド */
const COMMAND_BRIEFS_ONLY = () => new Set((handbookCommands as { id: string }[]).map((c) => c.id));
const stepsOf = (t: (typeof HANDBOOK_TOPICS)[number]) => [...t.flow, ...t.try.flatMap((x) => x.steps)];
const TOPICS = HANDBOOK_TOPICS.filter((t) => LINE_NOTE_TOPICS.has(t.id));
const rowsOf = (t: (typeof HANDBOOK_TOPICS)[number]) => stepsOf(t).flatMap((s) => (s.code?.language === 'bash' ? commandRows(s.code.text) : []));

describe('コマンドの行の中のコマンドをページへつなぐ', () => {
  it('パイプ・sudo・$( ) の後ろと、道の付いた名前も見つける', () => {
    expect(ids('curl -sfL https://get.k3s.io | sh -')).toEqual(['curl', 'sh']);
    expect(ids('sudo chown "$(id -u):$(id -g)" f')).toEqual(['sudo', 'chown', 'id', 'id']);
    expect(ids('/usr/local/bin/k3s-uninstall.sh')).toEqual(['k3s-uninstall']);
    expect(ids('kubectl create namespace x && mkdir -p a')).toEqual(['kubectl-create-namespace', 'mkdir']);
    expect(ids('kubectl get pods & cp a `id -u`')).toEqual(['kubectl-get', 'cp', 'id']);
    expect(ids('kubectl label nodes "$(kubectl get nodes -o jsonpath=\'{.items[0]}\')" a=b | grep x')).toEqual(['kubectl-label', 'kubectl-get', 'grep']);
  });
  it('引数や引用符の中は拾わず、知らないコマンドは知らせる', () => {
    expect(ids("echo 'export A=1; cp a b' >> f")).toEqual(['echo']);
    expect(ids('echo "a; cp b | sh"')).toEqual(['echo']);
    expect(ids('cp sh id')).toEqual(['cp']);
    expect(ids('cat a 2>&1 | grep b')).toEqual(['cat', 'grep']);
    expect(ids('cp a `id -u` sh')).toEqual(['cp', 'id']);
    expect(ids('echo "a \\"; cp b"')).toEqual(['echo']);
    expect(linkShell('cpx a', COMMAND_BRIEFS).unknown).toEqual(['cpx']);
    expect(linkShell('sh/x a', COMMAND_BRIEFS).unknown).toEqual(['sh/x']);
  });
  it('コードを打つ行に分ける (コメント・行末のコメント・ヒアドキュメントの中身は除く)', () => {
    expect(commandRows("# 説明\nkubectl get pods   # a; cp b\n\ncat > f <<'EOF'\nid\n# x\nEOF\necho 'a # b'")).toEqual(['kubectl get pods', "cat > f <<'EOF'", "echo 'a # b'"]);
    expect(commandRows('grep a <<< foo\ncp a b\necho $((1<<2))\nid\necho "<<EOF"\nid -u')).toHaveLength(6);
    expect(commandRows("cat <<'END-1'\nx\nEND-1\nid")).toEqual(["cat <<'END-1'", 'id']);
    expect(commandRows('kubectl run a \\\n  --image=b\nid')).toEqual(['kubectl run a --image=b', 'id']);
    expect(() => commandRows('cat <<EOF\nid')).toThrow(/終わり/);
  });
});

describe('コマンドの意味', () => {
  it('付け終えたトピックの id は実在し、全部の行に意味と、全部のコマンドにページがある', () => {
    expect(TOPICS.length).toBe(LINE_NOTE_TOPICS.size);
    const missing: string[] = [];
    for (const t of TOPICS)
      for (const row of rowsOf(t)) {
        const { pieces, unknown } = linkShell(row, COMMAND_BRIEFS);
        if (!LINE_NOTES.get(row)?.trim()) missing.push(`${t.id}: 意味が無い: ${row}`);
        for (const u of unknown) missing.push(`${t.id}: ページの無いコマンド ${u}: ${row}`);
        expect(pieces.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(row);
        for (const p of pieces) if (typeof p !== 'string' && !findCommandPage(p.id)) missing.push(`${p.id} のページが無い`);
      }
    expect(missing).toEqual([]);
  });
  it('使われない意味・2 つのファイルに同じ行が無い', async () => {
    const used = new Set(TOPICS.flatMap(rowsOf));
    expect([...LINE_NOTES.keys()].filter((k) => !used.has(k))).toEqual([]);
    const files = Object.values(import.meta.glob<Record<string, string>>('../src/content/lineNotes/*.json', { eager: true, import: 'default' }));
    expect(files.reduce((n, f) => n + Object.keys(f).length, 0)).toBe(LINE_NOTES.size);
  });
  it('前の手順に全部出てきた行だけの手順は畳む。付け終えていないトピックには出さない', () => {
    const step = (text: string) => ({ text: 'x', code: { language: 'bash' as const, text } });
    expect(topicLineNotes('setup-k3s', [step('kubectl get nodes'), step('kubectl get nodes'), { text: 'y' }]).map((x) => [x.notes.length, x.repeated])).toEqual([[1, false], [1, true], [0, false]]);
    expect(lineNotes('linux-foundation-cncf', step('kubectl get nodes'))).toEqual([]);
  });
  it('ハンドブックだけのコマンドは、id と名前が重ならず、usedIn が実際に使うトピックと同じ', () => {
    expect(new Set(COMMAND_PAGES.map((p) => p.id)).size).toBe(COMMAND_PAGES.length);
    expect(new Set(COMMAND_PAGES.map((p) => p.command)).size).toBe(COMMAND_PAGES.length);
    const own = COMMAND_BRIEFS_ONLY();
    for (const p of COMMAND_PAGES.filter((x) => own.has(x.id))) {
      const topics = TOPICS.filter((t) => rowsOf(t).some((r) => ids(r).includes(p.id)));
      expect(p.usedIn, p.id).toEqual(topics.map((t) => ({ topic: t.id, label: findTopic(t.id)!.topic.title })));
      expect(topics.length, p.id).toBeGreaterThan(0);
    }
  });
});
