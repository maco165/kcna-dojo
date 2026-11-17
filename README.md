# kcna-dojo

KCNA-JP (Kubernetes and Cloud Native Associate 日本語版) の学習サイト。週ごとのレッスンで、コマンドの穴埋め・YAML や Dockerfile の穴埋め・4 択・家のクラスタでの実習を解く。進捗はブラウザの localStorage にだけ残し、サーバーは持たない。

- サイト: https://maco165.github.io/kcna-dojo/
- 見た目: Meta の [Astryx](https://github.com/meta/astryx) (`@astryxdesign/core` と `theme-neutral`。強調の色だけ core の既定の青)
- 管理: [AI-Repository](https://github.com/maco165/AI-Repository) の PJ-028 (要件と backlog は `projects/PJ-028-kcna-dojo/design/`)

この README は設計書を兼ねる。作りを変えたら、同じ PR でここと図を直す。

## 全体の作り

```mermaid
flowchart LR
  subgraph repo[このリポジトリ]
    json[src/content/week*.json<br/>問題データ]
    check[scripts/check-content.mjs<br/>データの検査]
    app[src/ React + Astryx]
  end
  json --> check
  json --> app
  app -->|vite build| dist[dist/]
  dist -->|GitHub Actions| pages[GitHub Pages]
  pages --> browser[ブラウザ]
  browser <-->|読み書き| ls[(localStorage<br/>kcna.v1)]
```

- 画面は 2 つ。ホーム (`#/week/<n>`) とレッスン (`#/lesson/<id>`)。GitHub Pages ではサーバーで経路を振り分けられないので、URL の `#` の後ろで決める (`src/lib/route.ts`)
- 問題データは JSON で同梱する。足すたびに `npm run check:content` で形を検査する
- 進捗は `src/lib/progress.ts` の関数が読み書きする。関数は保存先と時刻を引数で受け取るので、テストで差し替えられる

## 学習の流れ

```mermaid
flowchart TD
  home[ホーム: 週のレッスンの一覧] -->|開始| q[問題を 1 問ずつ解く]
  q -->|確かめる| fb{正解?}
  fb -->|正解 +3 XP| ok[解説・実行結果の例]
  fb -->|不正解| ng[選んだものがなぜ違うか + 解説]
  ok --> next{最後の問題?}
  ng --> next
  next -->|いいえ| q
  next -->|はい| done[完了画面: 正答数・XP・今日の目標]
  done -->|一覧へ戻る| home
  home -->|実習| lab[手順を確かめて印を付ける] -->|完了にする +10 XP| done
```

- ホームでは、まだ終えていない最初のレッスンだけが「開始」になる。ほかのレッスンもいつでも開ける
- 採点 (`src/lib/grade.ts`): 穴埋めは前後の空白を無視し、間の空白の並びを 1 つにして比べる。大文字と小文字は区別する (kubectl も YAML の kind も区別するため)。`answers` のどれかに一致すれば正解
- 今日の目標は 30 XP。連続日数は、レッスンを終えた日が前日の翌日なら 1 増え、1 日以上空くと 1 に戻る。今日も昨日も学んでいなければ 0 と出す

## 進捗の保存 (localStorage のキー `kcna.v1`)

```json
{
  "v": 1,
  "streak": { "count": 2, "lastDay": "2026-11-24" },
  "xp": { "total": 36, "byDay": { "2026-11-23": 21, "2026-11-24": 15 } },
  "lessons": { "w1-l1": { "done": true, "best": 0.8, "at": "2026-11-23T00:00:00.000Z" } },
  "answers": { "w1-l1-q1": { "right": 1, "wrong": 1, "last": "2026-11-24T00:00:00.000Z" } }
}
```

- 日付は端末の時刻で数える
- 問題文は保存しない。id だけを持つ
- 壊れた JSON や形の違うものが入っていたら、例外を出さずに空の進捗で始める

## 問題データ (`src/content/week<n>.json`)

型の正本は `src/content/types.ts`。検査 (`scripts/check-content.mjs`) は同じ欄を見る。

| 種類 | 必須の欄 | 説明 |
|---|---|---|
| 共通 | `id` `type` `prompt` `explanation` `source` | `id` は全体で重複しない。`source` は確かめた公式の文書の https の URL |
| `fill` (穴埋め) | `language` (`bash` / `yaml` / `dockerfile`)、`code`、`answers` | `code` に `{{blank}}` をちょうど 1 つ。`candidates` (押して入れる候補)、`output` (正解のあとに出す実行結果の例)、`wrongNotes` (候補ごとのなぜ違うか) は任意 |
| `choice` (4 択) | `choices` (`id` と `text`)、`answer` | `answer` は選択肢の `id`。`why` (なぜ違うか) と `code` (出力を読む問題の出力) は任意 |
| 実習 (`kind: lab`) | `steps` (`text`、任意で `command`)、`source` | 全部の手順に印を付けると完了にできる |

週の並び・日付・「説明できるようにすること」は `src/content/curriculum.ts`。

問題は公式の文書 (kubernetes.io・docs.k3s.io・opencontainers.org・docs.docker.com) で確かめた内容から書き起こす。実際の試験問題は写さない。

## 開発

```bash
npm ci
npm run dev            # 手元で開く
npm run check:content  # 問題データの検査
npm test               # 採点・進捗・データ検査のテスト (vitest)
npm run e2e            # 組み立ててブラウザで通しの検査 (Playwright。390 幅と 1280 幅)
npm run build          # 型検査と本番の組み立て
```

- テーマを変えるときは `src/themes/kcna/kcnaTheme.ts` を直し、`npm run astryx -- theme build src/themes/kcna/kcnaTheme.ts` の出力も一緒にコミットする
- Astryx の部品の使い方は `npm run astryx -- component <名前>` で、入っている版の文書を読む
- main へのマージで GitHub Actions が検査・テスト・組み立てを通し、Pages に配る。PR では配らずに検査だけ走る。e2e はブラウザが要るので手元で走らせる

## ライセンス

MIT
