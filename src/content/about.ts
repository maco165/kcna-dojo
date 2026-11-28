// 「このサイトについて」の文。画面 (screens/About.tsx) と、書き出す HTML (scripts/prerender.mjs) が同じ文を使う
import { SITE_NAME } from '../lib/site';

export const ABOUT = {
  intro: `${SITE_NAME} (クラウドネイティブの略) は、KCNA-JP (Kubernetes and Cloud Native Associate 日本語版) の対策のための、個人が作った非公式の学習サイトです。コマンドや YAML の穴埋め・4 択を週ごとに解く「問題演習」と、自分の端末で動かして確かめる「実践」に分かれています。`,
  notice: 'The Linux Foundation・CNCF とは関係ありません。Kubernetes と KCNA は The Linux Foundation の商標です。',
  source: 'サイトのコードと問題のデータは、すべて GitHub で公開しています。',
  issue: '問題は公式の文書 (kubernetes.io・docs.k3s.io など) で確かめて書いていますが、誤りがあれば Issue で知らせてください。問題の id (例: w1-l3-q2) を添えると早く直せます。実践の章で詰まったときは、手順の下の「ここで詰まった」から、章と手順の入った下書きを開けます。',
  storage: '進み具合 (実践の手順の印も) はこのブラウザの localStorage (キー kcna.v1) にだけ残り、サーバーには送りません。',
  askAi: '問題文や実践の手順を入れた Claude / ChatGPT を新しいタブで開くだけで、送るかどうかは開いた先で決めます。',
  questions: '実際の試験問題は写していません。各問の解説の下に出典を付けています。',
};
