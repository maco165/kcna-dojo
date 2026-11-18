// ハンドブックの手順のコマンドを読み、「何を・どこで・どうする」を取り出す (手順の絵に使う)。
// 文字はコマンドから取るので、本文と食い違わない
export type Op = 'create' | 'apply' | 'read' | 'logs' | 'wait' | 'enter' | 'change' | 'delete';

export type Action = {
  op: Op;
  /** 操作の言葉 (例: 作る・見る・待つ) */
  verb: string;
  tool: string;
  /** 対象の種類 (例: Deployment) */
  kind: string;
  name?: string;
  /** 対象のある場所 (名前空間の名前・すべての名前空間・クラスタ・手元・ノード) */
  where: string;
};

const KINDS: Record<string, string> = {
  pod: 'Pod', pods: 'Pod', po: 'Pod',
  deployment: 'Deployment', deployments: 'Deployment', deploy: 'Deployment',
  replicaset: 'ReplicaSet', replicasets: 'ReplicaSet', rs: 'ReplicaSet',
  statefulset: 'StatefulSet', statefulsets: 'StatefulSet', sts: 'StatefulSet',
  daemonset: 'DaemonSet', daemonsets: 'DaemonSet', ds: 'DaemonSet',
  job: 'Job', jobs: 'Job', cronjob: 'CronJob', cronjobs: 'CronJob', cj: 'CronJob',
  service: 'Service', services: 'Service', svc: 'Service',
  endpointslice: 'EndpointSlice', endpointslices: 'EndpointSlice',
  ingress: 'Ingress', ingresses: 'Ingress', ing: 'Ingress', ingressclass: 'IngressClass', ingressclasses: 'IngressClass',
  networkpolicy: 'NetworkPolicy', networkpolicies: 'NetworkPolicy', netpol: 'NetworkPolicy',
  namespace: 'Namespace', namespaces: 'Namespace', ns: 'Namespace',
  node: 'Node', nodes: 'Node', no: 'Node',
  persistentvolumeclaim: 'PVC', persistentvolumeclaims: 'PVC', pvc: 'PVC',
  persistentvolume: 'PV', persistentvolumes: 'PV', pv: 'PV',
  storageclass: 'StorageClass', storageclasses: 'StorageClass', sc: 'StorageClass',
  secret: 'Secret', secrets: 'Secret', configmap: 'ConfigMap', configmaps: 'ConfigMap', cm: 'ConfigMap',
  serviceaccount: 'ServiceAccount', serviceaccounts: 'ServiceAccount', sa: 'ServiceAccount',
  role: 'Role', roles: 'Role', rolebinding: 'RoleBinding', rolebindings: 'RoleBinding',
  clusterrole: 'ClusterRole', clusterroles: 'ClusterRole', clusterrolebinding: 'ClusterRoleBinding',
  resourcequota: 'ResourceQuota', resourcequotas: 'ResourceQuota', quota: 'ResourceQuota',
  horizontalpodautoscaler: 'HPA', horizontalpodautoscalers: 'HPA', hpa: 'HPA',
  event: 'Event', events: 'Event', all: 'すべての種類',
};
/** 名前空間に属さない種類 */
const CLUSTER_KINDS = new Set(['Namespace', 'Node', 'PV', 'StorageClass', 'ClusterRole', 'ClusterRoleBinding', 'IngressClass', 'API', 'クラスタ']);

/** $(...) を置き換えた印。中のコマンドは SUBST に取っておく */
const SUBST_RE = /^__SUBST(\d+)__$/;
let SUBST: string[] = [];

function kindOf(token: string | undefined): { kind: string; name?: string } {
  if (!token) return { kind: 'リソース' };
  const sub = token.match(SUBST_RE);
  if (sub) {
    // $(kubectl get pods ...) のときは、中のコマンドの種類を使う (名前は出さない)
    const inner = SUBST[Number(sub[1])].trim().split(/\s+/);
    return { kind: inner[0] === 'kubectl' && inner[1] === 'get' ? kindOf(inner[2]).kind : 'リソース' };
  }
  const [t, name] = token.split('/');
  // カンマで並べた種類は全部出す (deployment,replicaset,pod → Deployment・ReplicaSet・Pod)
  const kinds = t.split(',').map((x) => KINDS[x.split('.')[0].toLowerCase()] ?? x);
  return { kind: kinds.join('・'), name };
}

/** 名前に出さない語 ($(...) の印) を落とす */
const nameOf = (token: string | undefined) => (token && !SUBST_RE.test(token) ? token : undefined);

/** 引数を、位置の引数と旗に分ける (値を取る旗は値も食べる) */
function splitArgs(tokens: string[]) {
  const VALUE = new Set(['-n', '--namespace', '-f', '--filename', '-l', '--selector', '-o', '--output', '--for', '--image', '--replicas', '-c', '--container', '--type', '--port', '--target-port', '--name', '--min', '--max', '--cpu', '--cpu-percent', '--timeout', '--to-revision', '--target', '--profile', '--copy-to', '--as', '--types', '--sort-by', '--api-group', '-L', '--label-columns', '--hard', '--requests', '--limits', '--set', '-k', '--from-literal', '--serviceaccount', '--role', '--clusterrole', '--verb', '--resource', '--rule', '--class', '--restart', '--image-pull-policy', '--raw', '--dry-run']);
  const BOOL = new Set(['-p', '--previous', '-A', '--all-namespaces', '-i', '-it', '-t', '--rm', '-w', '--watch', '--wait', '--create-namespace']);
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') break;
    if (t.startsWith('-')) {
      const [k, v] = t.split('=');
      if (v !== undefined) flags[k] = v;
      else if (BOOL.has(k)) flags[k] = true;
      else if (VALUE.has(k)) flags[k] = tokens[++i] ?? '';
      else flags[k] = true;
    } else pos.push(t);
  }
  return { pos, flags };
}

function whereOf(kind: string, flags: Record<string, string | true>): string {
  if (flags['-A'] || flags['--all-namespaces']) return 'すべての名前空間';
  if (kind.split('・').every((k) => CLUSTER_KINDS.has(k))) return 'クラスタ';
  const ns = flags['-n'] ?? flags['--namespace'];
  return typeof ns === 'string' && ns ? ns : '今の名前空間';
}

/** heredoc の YAML から kind と metadata.name を拾う (行ごとに読む。正規表現の後戻りで止まらないように) */
function manifestKinds(yaml: string): { kind: string; name?: string; namespace?: string }[] {
  const out: { kind: string; name?: string; namespace?: string }[] = [];
  for (const doc of yaml.split(/^---\s*$/m)) {
    let kind: string | undefined;
    let name: string | undefined;
    let namespace: string | undefined;
    let inMeta = false;
    for (const line of doc.split('\n')) {
      const k = line.match(/^kind:\s*(\S+)/);
      if (k) kind = k[1];
      if (/^metadata:\s*$/.test(line)) {
        inMeta = true;
        continue;
      }
      if (inMeta) {
        if (/^\S/.test(line)) inMeta = false;
        else {
          const n = line.match(/^\s{2}name:\s*(\S+)/);
          if (n && !name) name = n[1];
          const ns = line.match(/^\s{2}namespace:\s*(\S+)/);
          if (ns && !namespace) namespace = ns[1];
        }
      }
    }
    if (kind) out.push({ kind: KINDS[kind.toLowerCase()] ?? kind, name, namespace });
  }
  return out;
}

/** 同じコードの中で cat > ファイル <<EOF と書いたマニフェスト (ファイル名 → 中身) */
let WRITTEN = new Map<string, string>();

function kubectl(tokens: string[], heredoc: string): Action[] {
  const all = kubectlActions(tokens, heredoc);
  const { flags } = splitArgs(tokens.slice(2));
  // --dry-run=server は API サーバーまで送って確かめるが保存しない。client (や値なし) はクラスタに送らず、手元に書き出すだけ
  if (flags['--dry-run'] === 'server') return all.map((x) => (x.op === 'create' || x.op === 'apply' ? { ...x, op: 'read', verb: '試しに送る (保存しない)' } : x));
  if (flags['--dry-run'] !== undefined && flags['--dry-run'] !== 'none')
    return all.map((x) => (x.op === 'create' || x.op === 'apply' ? { ...x, op: 'read', verb: '書き出す', where: '手元' } : x));
  return all;
}

function kubectlActions(tokens: string[], heredoc: string): Action[] {
  const verb = tokens[1];
  const { pos, flags } = splitArgs(tokens.slice(2));
  const a = (op: Op, word: string, k: { kind: string; name?: string }, where?: string): Action => ({
    op,
    verb: word,
    tool: 'kubectl',
    kind: k.kind,
    name: k.name?.replace(/\uE000/g, ' '),
    where: where ?? whereOf(k.kind, flags),
  });
  const fromFile = (op: Op, word: string): Action[] => {
    const file = typeof flags['-f'] === 'string' ? flags['-f'] : undefined;
    const yaml = heredoc || (file ? WRITTEN.get(file) : undefined) || '';
    const kinds = yaml ? manifestKinds(yaml) : [];
    const ns = typeof flags['-n'] === 'string' ? flags['-n'] : undefined;
    if (kinds.length) return kinds.map((k) => a(op, word, k, CLUSTER_KINDS.has(k.kind) ? 'クラスタ' : (ns ?? k.namespace ?? '今の名前空間')));
    const f = flags['-f'] ?? flags['-k'] ?? pos[0];
    // 中身を読めないファイルで -n も無ければ、場所はマニフェストに書いてあるとおり
    return [a(op, word, { kind: 'マニフェスト', name: typeof f === 'string' ? f : undefined }, ns ?? 'マニフェストのとおり')];
  };
  switch (verb) {
    case 'create': {
      if (flags['-f'] !== undefined) return fromFile('create', '作る');
      const k = kindOf(pos[0]);
      if (k.kind === 'Secret' || pos[0] === 'secret') return [a('create', '作る', { kind: 'Secret', name: pos[2] })];
      return [a('create', '作る', { kind: k.kind, name: pos[1] })];
    }
    case 'apply':
      return fromFile('apply', '反映する');
    case 'diff':
      return fromFile('read', '違いを見る');
    case 'kustomize':
      return [a('read', '組み立てて見る', { kind: 'マニフェスト', name: pos[0] }, '手元')];
    case 'run':
      // --rm は一時の Pod で命令を動かし、終われば消える
      if (flags['--rm']) return [a('enter', '一時の Pod で動かす', { kind: 'Pod', name: pos[0] })];
      return [a('create', '作る', { kind: 'Pod', name: pos[0] })];
    case 'expose':
      return [a('create', '作る', { kind: 'Service', name: typeof flags['--name'] === 'string' ? flags['--name'] : (pos[1] ?? kindOf(pos[0]).name) })];
    case 'autoscale':
      return [a('create', '作る', { kind: 'HPA', name: pos[1] ?? kindOf(pos[0]).name })];
    case 'get':
    case 'describe': {
      if (typeof flags['--raw'] === 'string') return [a('read', '見る', { kind: 'API', name: flags['--raw'] }, 'クラスタ')];
      const k = kindOf(pos[0]);
      return [a('read', verb === 'get' ? '見る' : '詳しく見る', { kind: k.kind, name: k.name ?? nameOf(pos[1]) })];
    }
    case 'events': {
      const target = typeof flags['--for'] === 'string' ? kindOf(flags['--for']) : { kind: 'Event' };
      return [a('read', 'イベントを見る', target, whereOf(target.kind, flags))];
    }
    case 'top':
      return [a('read', '使用量を見る', kindOf(pos[0]))];
    case 'logs':
      return [a('logs', flags['-p'] || flags['--previous'] ? '前のログを読む' : 'ログを読む', target(pos[0]))];
    case 'exec':
    case 'attach':
      return [a('enter', '中で動かす', target(pos[0]))];
    case 'debug':
      return [a('enter', 'デバッグのコンテナを足す', target(pos[0]))];
    case 'port-forward':
      return [a('enter', '手元へつなぐ', kindOf(pos[0]))];
    case 'delete': {
      const k = kindOf(pos[0]);
      if (flags['-f'] !== undefined) return fromFile('delete', '消す');
      return [a('delete', '消す', { kind: k.kind, name: k.name ?? (pos.slice(1).map(nameOf).filter(Boolean).join(' ') || undefined) })];
    }
    case 'set':
      return [a('change', pos[0] === 'image' ? 'イメージを変える' : '設定を変える', kindOf(pos[1]).name ? kindOf(pos[1]) : { kind: kindOf(pos[1]).kind, name: pos[2] })];
    case 'scale':
      return [a('change', '数を変える', kindOf(pos[0]).name ? kindOf(pos[0]) : { kind: kindOf(pos[0]).kind, name: pos[1] })];
    case 'label':
    case 'annotate':
    case 'taint':
    case 'patch': {
      const k = kindOf(pos[0]);
      const word = verb === 'label' ? 'ラベルを付ける' : verb === 'taint' ? 'taint を付ける' : verb === 'annotate' ? '注釈を付ける' : '一部を書き換える';
      return [a('change', word, { kind: k.kind, name: k.name ?? nameOf(pos[1]) })];
    }
    case 'rollout': {
      const k = kindOf(pos[1]);
      const sub = pos[0];
      if (sub === 'status') return [a('wait', '終わるまで待つ', k)];
      if (sub === 'history') return [a('read', '履歴を見る', k)];
      return [a('change', sub === 'undo' ? '巻き戻す' : '入れ替える', k)];
    }
    case 'wait': {
      const k = kindOf(pos[0]);
      return [a('wait', '待つ', { kind: k.kind, name: k.name ?? pos[1] })];
    }
    case 'auth': {
      // auth whoami: 認証で決まった自分の名前を確かめる (権限は見ない)
      if (tokens[2] === 'whoami') return [{ op: 'read', verb: '名乗りを確かめる', tool: 'kubectl', kind: '自分のユーザー', where: 'クラスタ' }];
      // auth can-i <動詞> <種類>: 動詞と種類と場所を出す
      if (pos[0] !== 'can-i') return [a('read', '権限を確かめる', { kind: 'API' }, 'クラスタ')];
      const k = kindOf(pos[2]);
      return [a('read', `${pos[1]} できるか確かめる`, { kind: k.kind })];
    }
    case 'config':
      return [a(pos[0]?.startsWith('set') || pos[0] === 'use-context' ? 'change' : 'read', pos[0] === 'use-context' ? '切り替える' : pos[0]?.startsWith('set') ? '設定を変える' : '見る', { kind: 'kubeconfig' }, '手元')];
    case 'explain':
    case 'api-resources':
    case 'api-versions':
    case 'version':
    case 'cluster-info':
      return [a('read', '見る', { kind: verb === 'explain' ? 'API の説明' : verb === 'version' ? '版' : 'API' }, 'クラスタ')];
    default:
      return [];
  }
}

/** logs・exec などの相手。種類/名前 (deploy/web) ならその種類、名前だけなら Pod */
function target(token: string | undefined): { kind: string; name?: string } {
  if (!token) return { kind: 'Pod' };
  if (token.includes('/')) return kindOf(token);
  return { kind: 'Pod', name: nameOf(token) };
}

function other(tokens: string[]): Action[] {
  const [tool, sub, arg] = tokens;
  const act = (op: Op, verb: string, kind: string, name: string | undefined, where: string): Action[] => [{ op, verb, tool, kind, name, where }];
  if (tool === 'helm') {
    const { pos, flags } = splitArgs(tokens.slice(2));
    const ns = typeof flags['-n'] === 'string' ? flags['-n'] : '今の名前空間';
    if (sub === 'create') return act('create', 'ひな形を作る', 'チャート', pos[0], '手元');
    if (sub === 'install') return act('apply', '入れる', 'リリース', pos[0], ns);
    if (sub === 'upgrade') return act('change', '上げる', 'リリース', pos[0], ns);
    if (sub === 'rollback') return act('change', '戻す', 'リリース', pos[0], ns);
    if (sub === 'history' || sub === 'list' || sub === 'status') return act('read', '履歴を見る', 'リリース', pos[0], ns);
    if (sub === 'uninstall') return act('delete', '消す', 'リリース', pos[0], ns);
    return [];
  }
  if (tool === 'docker') {
    if (sub === 'build') {
      const t = tokens.indexOf('-t');
      return act('create', 'ビルドする', 'イメージ', t >= 0 ? tokens[t + 1] : undefined, '手元');
    }
    if (sub === 'rmi') return act('delete', '消す', 'イメージ', arg, '手元');
    if (sub === 'save') return act('read', '書き出す', 'イメージ', arg, '手元');
    return [];
  }
  if (tool === 'crictl') {
    if (sub === 'ps') return act('read', '見る', 'コンテナ', undefined, 'ノード');
    if (sub === 'pods') return act('read', '見る', 'Pod', undefined, 'ノード');
    if (sub === 'images') return act('read', '見る', 'イメージ', undefined, 'ノード');
    if (sub === 'rmi') return act('delete', '消す', 'イメージ', arg, 'ノード');
    return [];
  }
  if (tool === 'ctr' && sub === 'images' && arg === 'import') return act('create', '取り込む', 'イメージ', undefined, 'ノード');
  // k3s を消すスクリプト (インストールのときに /usr/local/bin に置かれる)
  if (/(^|\/)k3s-uninstall\.sh$/.test(tool)) return [{ op: 'delete', verb: '消す', tool: 'k3s', kind: 'k3s server', where: 'ノード' }];
  if (/(^|\/)k3s-agent-uninstall\.sh$/.test(tool)) return [{ op: 'delete', verb: '消す', tool: 'k3s', kind: 'k3s agent', where: 'ノード' }];
  // ノードの上の Linux の様子を見るもの (Linux とコンテナの付録)
  if (tool === 'stat' && tokens.includes('-fc')) return act('read', '見る', 'ファイルシステムの種類', tokens[tokens.length - 1], 'ノード');
  if (tool === 'findmnt') return act('read', '見る', 'マウント', undefined, 'ノード');
  if (tool === 'lsns') return act('read', '見る', 'namespace', undefined, 'ノード');
  // ノードの上で直に見るもの (k3s の付録)。デバッグ用コンテナの中の素の ps は飛ばす
  if (tool === 'ls' && sub?.startsWith('/')) return act('read', '見る', 'ファイル', sub, 'ノード');
  if (tool === 'ps' && sub?.startsWith('-')) return act('read', '見る', 'プロセス', undefined, 'ノード');
  if (tool === 'journalctl') {
    const u = tokens.indexOf('-u');
    return act('logs', '記録を見る', 'サービス', u >= 0 ? tokens[u + 1] : undefined, 'ノード');
  }
  return [];
}

/** 手順のコードから、起きることを順に取り出す (コマンドの無い行・ファイル操作などは飛ばす) */
export function commandActions(text: string, language: 'bash' | 'yaml'): Action[] {
  if (language !== 'bash') return [];
  SUBST = [];
  WRITTEN = new Map();
  // $(...) は 1 語の印に、<空白を含む置き字> は空白を私用の字に替えてから語に分ける
  const prepared = text
    .replace(/\\\n/g, ' ')
    .replace(/\$\(([^()]*)\)/g, (_, inner: string) => `__SUBST${SUBST.push(inner) - 1}__`)
    .replace(/<[^<>\n]*>/g, (m) => (m.startsWith('<<') ? m : m.replace(/ /g, '\uE000')));
  const lines = prepared.split('\n');
  const out: Action[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    // heredoc の中身 (YAML) を集める
    let heredoc = '';
    const hd = line.match(/<<-?\s*'?(\w+)'?/);
    if (hd) {
      const end = hd[1];
      const body: string[] = [];
      while (++i < lines.length && lines[i].trim() !== end) body.push(lines[i]);
      heredoc = body.join('\n');
      // cat > web.yaml <<EOF は、あとの kubectl apply -f web.yaml のために取っておく
      const file = line.match(/^cat\s*>\s*(\S+)/);
      if (file) {
        WRITTEN.set(file[1], heredoc);
        continue;
      }
    }
    // 公式のインストールスクリプト (curl ... | sh -)。K3S_URL を渡すと agent として参加する
    if (/^curl\b.*get\.k3s\.io.*\|.*\bsh\b/.test(line)) {
      out.push(/\bK3S_URL=/.test(line) ? { op: 'create', verb: '参加させる', tool: 'k3s', kind: 'agent のノード', where: 'クラスタ' } : { op: 'create', verb: '入れる', tool: 'k3s', kind: 'k3s server', where: 'ノード' });
      continue;
    }
    const segs = line.replace(/<<-?\s*'?\w+'?/, '').split(/\s*(&&|\|\||;|\|)\s*/);
    for (let j = 0; j < segs.length; j += 2) {
      // a || b の b は a が失敗したときの代わりなので、同じことを 2 度描かない
      if (segs[j - 1] === '||') continue;
      const seg = segs[j];
      const tokens = seg
        .trim()
        .replace(/^sudo\s+/, '')
        .replace(/^k3s\s+/, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.replace(/^['"]|['"]$/g, ''));
      if (!tokens.length) continue;
      if (tokens[0] === 'kubectl') out.push(...kubectl(tokens, heredoc));
      else out.push(...other(tokens));
    }
  }
  return out;
}

/** 読み上げと見出しに使う 1 行 (例: 作る: Deployment web (名前空間 try-kcna)) */
export function describeAction(a: Action): string {
  const place = isPlaceWord(a.where) ? a.where : `名前空間 ${a.where}`;
  return `${a.verb}: ${a.kind}${a.name ? ` ${a.name}` : ''} (${place})`;
}

/** 名前空間の名前ではなく、場所を表す言葉か */
export const isPlaceWord = (w: string) => ['クラスタ', '手元', 'ノード', 'すべての名前空間', '今の名前空間', 'マニフェストのとおり'].includes(w);
