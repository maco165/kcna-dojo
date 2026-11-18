import { describe, expect, it } from 'vitest';
import { allQuestions } from '../src/content';
import commands from '../src/content/commands.json';
import { EXAM_ONLY } from '../src/content/examBank';
import { TOOLS, commandLines, commandUses, matchLine, unknownCommands, type CommandData } from '../src/lib/commandRefs';
import type { Question } from '../src/content/types';

const DATA = commands as CommandData;
const QUESTIONS = [...allQuestions(), ...EXAM_ONLY].map((r) => r.question);
/** 公式のリファレンスとして使ってよい所 */
const OFFICIAL = ['kubernetes.io', 'helm.sh', 'docs.docker.com', 'docs.k3s.io', 'etcd.io', 'argo-cd.readthedocs.io', 'fluxcd.io', 'kubectl.docs.kubernetes.io', 'curl.se', 'man7.org', 'bind9.readthedocs.io'];
/** GitHub は公式の組織のリポジトリだけ (個人のリポジトリを出典にしない) */
const OFFICIAL_GITHUB = ['kubernetes', 'kubernetes-sigs', 'helm', 'docker', 'etcd-io', 'k3s-io', 'containerd', 'isc-projects', 'curl'];
const isOfficial = (url: string) => {
  const u = new URL(url);
  if (u.hostname === 'github.com') return OFFICIAL_GITHUB.includes(u.pathname.split('/')[1]);
  return OFFICIAL.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
};

describe('コマンドの説明のデータ', () => {
  it('問題に出てくるコマンドとオプションには、すべて説明がある', () => {
    const missing = QUESTIONS.flatMap((q) => unknownCommands(q, DATA).map((u) => `${q.id}: ${u.reason} ${u.token} (${u.line})`));
    expect(missing).toEqual([]);
  });
  it('説明はどれも問題のどこかで使われている (使われない説明を持たない)', () => {
    const used = new Set(QUESTIONS.flatMap((q) => commandUses(q, DATA).map((u) => u.entry.id)));
    expect(DATA.commands.map((c) => c.id).filter((id) => !used.has(id))).toEqual([]);
  });
  it('id は重ならず、コマンドは道具の名前で始まり、出典は公式の https のページ', () => {
    const ids = DATA.commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = DATA.commands.map((c) => c.command);
    expect(new Set(names).size).toBe(names.length);
    for (const c of DATA.commands) {
      expect(TOOLS as readonly string[], c.id).toContain(c.command.split(' ')[0]);
      expect(c.summary.length, c.id).toBeGreaterThan(5);
      expect(c.usage.startsWith(c.command.split(' ')[0]), c.id).toBe(true);
      for (const url of [c.source, ...(c.refs ?? []).map((r) => r.url)]) {
        expect(new URL(url).protocol, c.id).toBe('https:');
        expect(isOfficial(url), `${c.id}: ${url}`).toBe(true);
      }
      for (const f of c.flags ?? []) {
        expect(f.flags.every((x) => /^--?[a-zA-Z]/.test(x)), `${c.id} ${f.flags}`).toBe(true);
        expect(f.text.length, `${c.id} ${f.flags}`).toBeGreaterThan(3);
      }
    }
    for (const t of DATA.tools) for (const f of t.globalFlags) expect(f.flags.every((x) => /^--?[a-zA-Z]/.test(x)), `${t.tool} ${f.flags}`).toBe(true);
  });
});

describe('コマンドの見つけ方', () => {
  const data: CommandData = {
    tools: [{ tool: 'kubectl', globalFlags: [{ flags: ['-n', '--namespace'], text: '名前空間' }], source: 'https://kubernetes.io/' }],
    commands: [
      { id: 'kubectl-get', command: 'kubectl get', summary: '一覧を出す', usage: 'kubectl get', flags: [{ flags: ['-o', '--output'], text: '出力の形' }], source: 'https://kubernetes.io/' },
      { id: 'kubectl-rollout', command: 'kubectl rollout', summary: 'ロールアウトを扱う', usage: 'kubectl rollout', source: 'https://kubernetes.io/' },
      { id: 'kubectl-rollout-undo', command: 'kubectl rollout undo', summary: '前の版に戻す', usage: 'kubectl rollout undo', source: 'https://kubernetes.io/' },
    ],
  };
  it('サブコマンドはいちばん長く一致するものに当て、オプションは = の前で引く (道具の共通のものも)', () => {
    expect(matchLine('kubectl rollout undo deployment/web', data).use?.entry.id).toBe('kubectl-rollout-undo');
    const get = matchLine('kubectl get pods -n kube-system --output=wide', data);
    expect(get.use?.entry.id).toBe('kubectl-get');
    expect(get.use?.flags.map((f) => f.flags[0])).toEqual(['-n', '-o']);
    expect(matchLine('kubectl get pods --watch', data).unknown.map((u) => u.token)).toEqual(['kubectl get --watch']);
    expect(matchLine('kubectl exec web', data).unknown[0].reason).toBe('command');
    // -- より後ろはコンテナの中のコマンド、閉じかっこは語に含めない
    expect(matchLine("kubectl get pods -- sh -c 'ls -la'", data).unknown).toEqual([]);
    expect(matchLine('kubectl get pods -o)', data).use?.flags.map((f) => f.flags[0])).toEqual(['-o']);
    // 前に置いたオプションは値ごと飛ばしてサブコマンドを読む
    expect(matchLine('kubectl -n kube-system get pods', data).use?.entry.id).toBe('kubectl-get');
    expect(matchLine('kubectl --namespace=web rollout undo deploy/web', data).use?.entry.id).toBe('kubectl-rollout-undo');
  });
  it('日本語の句読点の後ろのコマンドと、パイプの後ろの 2 つ目のコマンドも拾う', () => {
    expect(commandLines('docker save hello:0.1 | sudo k3s ctr images import -')).toEqual(['docker save hello:0.1', 'k3s ctr images import -']);
    expect(commandLines('落ちているので、kubectl logs --previous を見る')).toEqual(['kubectl logs --previous']);
    expect(commandLines('helm install し、helm upgrade を試す')).toEqual(['helm install', 'helm upgrade']);
  });
  it('公式の出典の判定: GitHub は公式の組織だけ', () => {
    expect(isOfficial('https://github.com/kubernetes/kubectl/blob/v0.37.2/pkg/cmd/get/get.go')).toBe(true);
    expect(isOfficial('https://github.com/someone/my-blog/blob/main/x.md')).toBe(false);
  });
  it('矢印や日本語の文はコマンドとして読まず、パイプの後ろは切る', () => {
    expect(commandLines('kubectl → kube-apiserver')).toEqual([]);
    expect(commandLines('$ kubectl get pods -o wide | grep web')).toEqual(['kubectl get pods -o wide']);
    expect(commandLines('kubectl → kube-apiserver → etcd')).toEqual([]);
    expect(commandLines('まず kubectl get pods で一覧を見る')).toEqual(['kubectl get pods']);
  });
  it('穴埋めの空欄は正解で埋めてから読み、同じコマンドは 1 つにまとめる', () => {
    const q: Question = { id: 't', type: 'fill', prompt: 'kubectl get で見る', language: 'bash', code: 'kubectl get pods {{blank}} wide', answers: ['-o'], explanation: 'x', source: 'https://kubernetes.io/' };
    const uses = commandUses(q, data);
    expect(uses).toHaveLength(1);
    expect(uses[0].flags.map((f) => f.flags[0])).toEqual(['-o']);
  });
});
