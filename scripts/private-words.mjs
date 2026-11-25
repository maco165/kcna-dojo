// 公開するデータに、家の端末やクラスタの名前・住所が入っていないかの規則。コマンドのページ (tests/commandPages.test.ts) と実践の章 (check-content.mjs) が使う。
// このリポジトリは公開なので、実在する名前をここに書き足さない (足りないものは、下の形の規則か、検査を走らせている端末の名前で見つける)
import os from 'node:os';

export const PRIVATE = /192\.168\.|slave-\d|pihole|keycloak|household|k3s-home|\/home\/maco/;

/** 章の仮想マシンで使ってよい利用者の名前と、ホストの名前 */
const USERS = ['ubuntu', 'root'];
const HOSTS = ['kcna'];
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
  // ログイン名: /home/名前、/Users/名前、C:\Users\名前
  for (const m of text.matchAll(/(?:\/home\/|\/Users\/|[A-Za-z]:\\+Users\\+)([A-Za-z0-9._-]+)/g)) if (!USERS.includes(m[1])) found.push(m[0]);
  // 端末の行頭やログインの 利用者@ホスト
  for (const m of text.matchAll(/\b([a-z][a-z0-9_-]*)@([A-Za-z0-9][A-Za-z0-9-]*)(?=[:\s"']|$)/g)) if (!USERS.includes(m[1]) || !HOSTS.includes(m[2])) found.push(m[0]);
  for (const n of names) if (new RegExp(`(?<![A-Za-z0-9])${escapeRe(n)}(?![A-Za-z0-9])`, 'i').test(text)) found.push(`走らせている端末の名前 (${n})`);
  return found;
}
