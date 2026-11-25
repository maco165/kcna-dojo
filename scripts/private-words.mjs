// 公開するデータに、家の端末やクラスタの名前・住所が入っていないかの規則。コマンドのページ (tests/commandPages.test.ts) と実践の章 (check-content.mjs) が使う。
// このリポジトリは公開なので、実在する名前をここに書き足さない (足りないものは、下の形の規則か、検査を走らせている端末の名前で見つける)
import os from 'node:os';

export const PRIVATE = /192\.168\.|slave-\d|pi-?hole|keycloak|household|k3s-home|\/home\/maco/i;

/** 章の仮想マシンで使ってよい利用者の名前と、ホストの名前 */
const USERS = ['ubuntu', 'root'];
const HOSTS = ['kcna'];
/** OS が持つ共有の置き場所 (利用者の名前ではない) */
const SHARED_DIRS = ['Shared', 'Public'];
/** 名前の形をしているが、どの環境にもある公開の宛先・systemd の unit・kubeadm が作る文脈の名前 */
const PUBLIC_ADDRESSES = ['git@github.com', 'user@1000.service', 'kubernetes-admin@kubernetes'];
/** @ の後ろが、住所ではなく版 (pkg@1.2・checkout@v4・pkg@latest) かイメージの digest (nginx@sha256) のもの。4 つの数字の並びは IP の住所なので含めない */
const VERSION = /^(?:v?\d+(?:\.\d+){0,2}(?:-[A-Za-z0-9.-]+)?|latest|next|sha256|sha512)$/;
/** URL の道 (出典の /home/ や @ を拾わないように落とし、ホストと利用者は残す)。日本語の文を巻き込まないよう ASCII だけを見る */
const URL_PATH = /(?<![\w./@-])((?:https?:\/\/[!-.0-~]+?|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}))\/[!#-&(-;=?-~]*/g;
/** どの端末にもある名前 (走らせている端末の名前がこれなら見ない) */
const COMMON = ['root', 'ubuntu', 'runner', 'node', 'user', 'localhost', 'kcna', 'docker', 'linux'];

/** 走らせている端末の、ログイン名とホスト名 */
export function localNames() {
  let user = '';
  try {
    user = os.userInfo().username;
  } catch {
    // 利用者の名前が引けない環境 (コンテナなど)
  }
  return [user, os.hostname()].filter((n) => n.length >= 4 && !COMMON.includes(n.toLowerCase()));
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 章の中の、載せてはいけない名前・住所 (無ければ空)。names は走らせている端末の名前 */
export function privateWords(text, names = localNames()) {
  const found = [];
  const hit = text.match(PRIVATE);
  if (hit) found.push(hit[0]);
  const body = text.replace(URL_PATH, '$1 ');
  // ログイン名: /home/名前、/Users/名前、C:\Users\名前
  for (const m of body.matchAll(/(?:\/home\/|\/Users\/|[A-Za-z]:\\+Users\\+)([A-Za-z0-9._-]+)/g)) if (![...USERS, ...SHARED_DIRS].includes(m[1].replace(/[._-]+$/, ''))) found.push(m[0]);
  // 利用者@ホスト (端末の行頭・ログイン先・メール)
  for (const m of body.matchAll(/(?<![A-Za-z0-9_.+-])([A-Za-z0-9_][A-Za-z0-9_.+-]*)@([A-Za-z0-9][A-Za-z0-9_.-]*)/g)) {
    const host = m[2].replace(/[._-]+$/, '');
    const ok = VERSION.test(host) || PUBLIC_ADDRESSES.includes(`${m[1]}@${host}`) || (USERS.includes(m[1]) && HOSTS.includes(host));
    if (!ok) found.push(m[0]);
  }
  for (const n of names) if (new RegExp(`(?<![A-Za-z0-9])${escapeRe(n)}(?![A-Za-z0-9])`, 'i').test(text)) found.push(`走らせている端末の名前 (${n})`);
  return found;
}
