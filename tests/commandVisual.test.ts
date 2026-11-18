import { describe, expect, it } from 'vitest';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { commandActions, describeAction } from '../src/lib/commandVisual';

const one = (t: string) => commandActions(t, 'bash').map(describeAction);

describe('commandActions', () => {
  it('作る・見る・読む・消す・変える・中に入るを読み分ける', () => {
    expect(one('kubectl create namespace try-kcna')).toEqual(['作る: Namespace try-kcna (クラスタ)']);
    expect(one('kubectl create deployment web --image=nginx:1.27-alpine --replicas=2 -n try-kcna')).toEqual(['作る: Deployment web (名前空間 try-kcna)']);
    expect(one('kubectl get pods -n try-kcna -o wide')).toEqual(['見る: Pod (名前空間 try-kcna)']);
    expect(one('kubectl logs crash -n try-kcna --previous')).toEqual(['前のログを読む: Pod crash (名前空間 try-kcna)']);
    expect(one('kubectl delete namespace try-kcna')).toEqual(['消す: Namespace try-kcna (クラスタ)']);
    expect(one('kubectl set image deployment/web nginx=nginx:1.28 -n try-kcna')).toEqual(['イメージを変える: Deployment web (名前空間 try-kcna)']);
    expect(one('kubectl exec -it web -n try-kcna -- sh')).toEqual(['中で動かす: Pod web (名前空間 try-kcna)']);
    expect(one('kubectl rollout status deployment/web -n try-kcna')).toEqual(['終わるまで待つ: Deployment web (名前空間 try-kcna)']);
    expect(one('kubectl get pods -A')).toEqual(['見る: Pod (すべての名前空間)']);
  });
  it('heredoc のマニフェストから種類と名前を拾い、YAML の中身は命令にしない', () => {
    const end = 'EO' + 'F';
    const t = `kubectl apply -n try-kcna -f - <<'${end}'\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec:\n  accessModes: [ReadWriteOnce]\n${end}\nkubectl get pvc data -n try-kcna`;
    expect(one(t)).toEqual(['反映する: PVC data (名前空間 try-kcna)', '見る: PVC data (名前空間 try-kcna)']);
  });
  it('コメント・ファイル操作・待つだけの行は絵にしない。YAML の手順も絵にしない', () => {
    expect(one('# 必要なときだけ\nsleep 60\nrm -r kust\ncat web.yaml')).toEqual([]);
    expect(commandActions('kind: Pod', 'yaml')).toEqual([]);
  });
  it('helm・docker・crictl も読む', () => {
    expect(one('helm install hello ./hello -n try-kcna --create-namespace')).toEqual(['入れる: リリース hello (名前空間 try-kcna)']);
    expect(one('docker build -t hello:0.1 .')).toEqual(['ビルドする: イメージ hello:0.1 (手元)']);
    expect(one('sudo k3s crictl ps')).toEqual(['見る: コンテナ (ノード)']);
  });
});

describe('ハンドブックの全手順', () => {
  const steps = HANDBOOK_TOPICS.flatMap((t) => [...t.flow, ...t.try.flatMap((x) => x.steps)].map((s) => ({ id: t.id, s })));
  it('bash のコードがある手順は、ほぼすべて絵になる (ならないものはファイル操作などだけ)', () => {
    for (const { id, s } of steps) {
      if (s.code?.language !== 'bash') continue;
      if (commandActions(s.code.text, 'bash').length > 0) continue;
      const first = s.code.text.split('\n').find((l) => l.trim() && !l.trim().startsWith('#')) ?? '';
      expect(`${id}: ${first}`).toMatch(/: (sleep|rm |mkdir|cat |printf|sed |ps |exit|export |echo )/);
    }
  });
  it('種類が「リソース」(読めなかった) になる手順が無い', () => {
    for (const { id, s } of steps) {
      if (s.code?.language !== 'bash') continue;
      for (const a of commandActions(s.code.text, 'bash')) expect(a.kind, `${id}: ${s.code.text.slice(0, 80)}`).not.toBe('リソース');
    }
  });
});
