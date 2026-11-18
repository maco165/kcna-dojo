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

describe('レビューで見つかった読み違い', () => {
  it('dry-run は手元に書き出すだけ', () => {
    expect(one('kubectl create deployment web --image=nginx:1.27 --dry-run=client -o yaml > kust/base/deployment.yaml')).toEqual(['書き出す: Deployment web (手元)']);
  });
  it('auth can-i は動詞・種類・名前空間を出す', () => {
    expect(one('kubectl auth can-i list pods -n default --as=system:serviceaccount:try-kcna:viewer')).toEqual(['list できるか確かめる: Pod (名前空間 default)']);
  });
  it('マニフェストの namespace を場所にする', () => {
    const end = 'EO' + 'F';
    expect(one(`kubectl apply -f - <<'${end}'\napiVersion: v1\nkind: Pod\nmetadata:\n  name: big\n  namespace: try-kcna\nspec: {}\n${end}`)).toEqual(['反映する: Pod big (名前空間 try-kcna)']);
  });
  it('cat > ファイル で書いたマニフェストを、あとの apply -f で読む。読めないファイルは「マニフェストのとおり」', () => {
    const end = 'EO' + 'F';
    expect(one(`cat > web.yaml <<'${end}'\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  namespace: try-kcna\n${end}\nkubectl apply -f web.yaml`)).toEqual(['反映する: Deployment web (名前空間 try-kcna)']);
    expect(one('kubectl apply -f web.yaml')).toEqual(['反映する: マニフェスト web.yaml (マニフェストのとおり)']);
  });
  it('$(...) は 1 語として扱い、名前に出さない', () => {
    expect(one('kubectl label nodes "$(kubectl get nodes -o jsonpath=\'{.items[0].metadata.name}\')" disktype=ssd')).toEqual(['ラベルを付ける: Node (クラスタ)']);
    expect(one('kubectl delete -n try-kcna $(kubectl get pods -n try-kcna -l app=web -o name | head -1)')).toEqual(['消す: Pod (名前空間 try-kcna)']);
  });
  it('--raw・種類/名前・複数の種類・空白を含む置き字・一時の Pod', () => {
    expect(one('kubectl get --raw /metrics')).toEqual(['見る: API /metrics (クラスタ)']);
    expect(one('kubectl logs deployment/web --tail=5')).toEqual(['ログを読む: Deployment web (今の名前空間)']);
    expect(one('kubectl exec deploy/web -- cat /etc/resolv.conf')).toEqual(['中で動かす: Deployment web (今の名前空間)']);
    expect(one('kubectl get deployment,replicaset,pod -n try-kcna')).toEqual(['見る: Deployment・ReplicaSet・Pod (名前空間 try-kcna)']);
    expect(one('kubectl debug -it <動いている Pod 名> --image=busybox:1.36 --target=<調べたいコンテナ名>')).toEqual(['デバッグのコンテナを足す: Pod <動いている Pod 名> (今の名前空間)']);
    expect(one('kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -n try-kcna -- wget -qO- http://web')).toEqual(['一時の Pod で動かす: Pod tmp (名前空間 try-kcna)']);
  });
});

describe('ノードの上のコマンド (付録)', () => {
  it('ls・ps・journalctl・インストールスクリプトを読み、|| の代わりの手は描かない', () => {
    expect(one('sudo ls /var/lib/rancher/k3s/server/manifests')).toEqual(['見る: ファイル /var/lib/rancher/k3s/server/manifests (ノード)']);
    expect(one("ps -ef | grep -E '[k]3s (server|agent)'")).toEqual(['見る: プロセス (ノード)']);
    expect(one('ps')).toEqual([]);
    expect(one('sudo journalctl -u k3s -n 20 --no-pager')).toEqual(['記録を見る: サービス k3s (ノード)']);
    expect(one('curl -sfL https://get.k3s.io | sh -')).toEqual(['入れる: k3s server (ノード)']);
    expect(one('curl -sfL https://get.k3s.io | K3S_URL=https://myserver:6443 K3S_TOKEN=mynodetoken sh -')).toEqual(['参加させる: agent のノード (クラスタ)']);
    expect(one('kubectl get storageclass || sudo k3s kubectl get storageclass')).toEqual(['見る: StorageClass (クラスタ)']);
    expect(one('kubectl get pods && kubectl get nodes')).toHaveLength(2);
    expect(one('/usr/local/bin/k3s-uninstall.sh')).toEqual(['消す: k3s server (ノード)']);
    expect(one('/usr/local/bin/k3s-agent-uninstall.sh')).toEqual(['消す: k3s agent (ノード)']);
    expect(one('stat -fc %T /sys/fs/cgroup/')).toEqual(['見る: ファイルシステムの種類 /sys/fs/cgroup/ (ノード)']);
    expect(one('findmnt -t proc,cgroup2')).toEqual(['見る: マウント (ノード)']);
    expect(one('lsns')).toEqual(['見る: namespace (ノード)']);
    expect(one('kubectl auth whoami')).toEqual(['名乗りを確かめる: 自分のユーザー (クラスタ)']);
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
      for (const a of commandActions(s.code.text, 'bash')) {
        const where = `${id}: ${s.code.text.slice(0, 80)}`;
        expect(a.kind, where).not.toBe('リソース');
        // 崩れた読み方 (空の種類・$( の切れ端・閉じていない <) が出ない
        expect(a.kind.trim(), where).not.toBe('');
        expect(`${a.kind} ${a.name ?? ''}`, where).not.toMatch(/\$\(|__SUBST|<[^>]*$/);
      }
    }
  });
});
