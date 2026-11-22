<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/banner-dark.png">
  <img alt="クラネイ: KCNA-JP 対策。コマンドと YAML の穴埋め・4 択を、週ごとのレッスンで。進捗はブラウザの中だけに残ります" src="docs/images/banner-light.png">
</picture>

**クラネイ** (クラウドネイティブの略) は、KCNA-JP (Kubernetes and Cloud Native Associate 日本語版) 対策の非公式の学習サイト。リポジトリ名は kcna-dojo。週ごとのレッスンで、コマンドの穴埋め・Dockerfile や YAML の穴埋め・4 択・家のクラスタでの実習を解く。間違えた問題は 1・3・7 日後に復習で出し、本番に近い 60 問・90 分の模擬試験と、問題に出る用語の用語集もある。進捗はブラウザの localStorage にだけ残し、サーバーは持たない。

| | |
|---|---|
| サイト | https://maco165.github.io/kcna-dojo/ (サイト名と副題の正本は `src/lib/site.ts`) |
| 見た目 | Meta の [Astryx](https://github.com/meta/astryx) (`@astryxdesign/core` の既定のトークンとシステムの字体)。デザイン案 https://claude.ai/artifact/TbAxSiWzdcuoxPPD155A6T に合わせる |
| 管理 | [AI-Repository](https://github.com/maco165/AI-Repository) の PJ-028 (要件と backlog は `projects/PJ-028-kcna-dojo/design/`) |

この README は設計書を兼ねる。作りを変えたら、同じ PR でここと図と画像を直す (画像は `npm run readme:images`)。

## 画面

<table>
  <tr>
    <td width="33%"><img alt="ホーム: 週のレッスンの一覧と今日の目標" src="docs/images/home-phone.png"></td>
    <td width="33%"><img alt="コマンドの穴埋め: 正解と実行結果の例" src="docs/images/fill-phone.png"></td>
    <td width="33%"><img alt="4 択: 不正解のとき、選んだものがなぜ違うかと解説" src="docs/images/choice-phone.png"></td>
  </tr>
  <tr>
    <td>ホーム。まだ終えていない最初のレッスンだけが「開始」になる</td>
    <td>コマンドの穴埋め。打っても候補を押しても入り、正解のあと実行結果の例が出る</td>
    <td>不正解のときは、選んだものがなぜ違うかを先に出し、解説と出典を続ける</td>
  </tr>
</table>

<table>
  <tr>
    <td width="25%"><img alt="復習: 今日の復習の問題の一覧" src="docs/images/review-phone.png"></td>
    <td width="25%"><img alt="進捗: 試験までの日数・分野ごとの正答率・7 日の XP" src="docs/images/progress-phone.png"></td>
    <td width="25%"><img alt="模擬試験: 残り時間と 1 問ずつの解答" src="docs/images/exam-phone.png"></td>
    <td width="25%"><img alt="用語集: 検索と用語の説明・出典・出てくるレッスン" src="docs/images/glossary-phone.png"></td>
  </tr>
  <tr>
    <td>復習。間違えた問題を 1・3・7 日後に出す</td>
    <td>進捗。計画との差と、分野ごとの正答率を見る</td>
    <td>模擬試験。4 分野の配点の割合で 60 問・90 分。途中では正誤を見せない</td>
    <td>用語集。語と説明の 1 行目の一覧を押して開く。分野で絞り、出てくるレッスンへ飛べる</td>
  </tr>
</table>

<img alt="PC のホーム: 左に週の一覧、本文にレッスンの一覧" src="docs/images/home-pc.png">

設定 (目標 XP・受験日・記録の書き出しと読み込み・記録を消す) は `docs/images/settings-phone.png`。

## 全体の作り

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': '-apple-system, Segoe UI, Roboto, sans-serif', 'primaryColor': '#FFFFFF', 'primaryTextColor': '#0A1317', 'primaryBorderColor': '#CCD3DB', 'lineColor': '#4E606F', 'clusterBkg': '#F1F4F7', 'clusterBorder': '#CCD3DB', 'tertiaryColor': '#F1F4F7'}}}%%
flowchart LR
  subgraph repo[このリポジトリ]
    json[src/content/week*.json<br/>exam/*.json<br/>問題データ]
    check[scripts/check-content.mjs<br/>データの検査]
    app[src/ React + Astryx]
  end
  json --> check
  json --> app
  app -->|vite build| dist[dist/]
  dist -->|GitHub Actions| pages[GitHub Pages]
  pages --> browser[ブラウザ]
  browser <-->|読み書き| ls[(localStorage<br/>kcna.v1)]
  browser -.->|問題文を入れて開く| ai[Claude / ChatGPT]
  classDef accent stroke:#0064E0,stroke-width:2px;
  class app,browser accent;
```

- 画面は 12 個。ホーム (`/week/<n>/`)、レッスン (`/lesson/<id>/`)、復習 (`/review/`)、進捗 (`/progress/`。試験までの日数・連続日数・計画との差・分野ごとの正答率 (レッスンの問題の答えで数える。第 4・5 回の初見の問題は本体を読まないと分野が分からないので入れず、模擬試験の結果で見る)・7 日の XP・週ごとの進み具合)、設定 (`/settings/`。目標・受験日・画面の色 (端末に合わせる・ライト・ダーク。この端末の見た目の設定で、記録を読み込んでも変えない)・記録の書き出しと読み込み・記録を消す)、模擬試験 (`/exam/`。4 分野の配点の割合で 60 問・90 分、最後にまとめて採点し、間違いは復習へ。問題の決まった第 1〜5 回 (`src/content/examSets.json`) とランダムがある。第 1〜3 回とランダムはレッスンの問題から、第 4・5 回はレッスンに無い初見の問題 (`src/content/exam/*.json`) から出す)、用語集 (`/glossary/`。問題に出る用語の説明・仕組みの図・出典・出てくるレッスン。データは `src/content/glossary.json` で、形は `tests/glossary.test.ts` が検査する。図は `src/content/glossaryFigures/*.json` で、関係の深い用語どうしが 1 つの図を共有し、箱の `term` で見ている用語の箱を強調する (主役の色と太い枠。失敗を表す赤い箱は赤のまま枠だけ太くする)。配置 (はみ出し・重なり・線が箱を通らない) は `tests/glossaryFigures.test.ts` がハンドブックの図と同じ検査で見る)、Kubernetes とこのサイト (`/guide/`。何を学ぶのか・試験の目的と形式・出題範囲・問題の作り方と出典の内訳。試験の事実と出典の正本は `src/content/guide.ts`、数は問題データから `src/lib/contentStats.ts` が数える)、ハンドブック (`/handbook/`、`/handbook/<id>/`。学習要領の細目 13 個ごとに、公式ドキュメントに沿ってコマンドと出力の例で流れを説明し、名前空間 try-kcna で試す手順・練習のレッスン・出典を付ける。目次は「試験の範囲」と「範囲外」の 2 部に分け、上に 2 部へ飛ぶリンク (トピックの数と確認済みの数) を置き、カードとトピックの頭に「試験の範囲」か「範囲外」の札を付ける。最後に、資格の範囲の外だが一緒に知っておいて損がないことを「範囲外」の段に分けて置く (Kubernetes をもっと知る・Linux とコンテナ・コミュニティ・作って届ける・クラウドの 5 段、13 トピック。`5-1-kubernetes.json`〜`5-5-cloud.json`、domain は「付録: 段の名前」で細目とは照らさない。段はファイルの名前の順に並ぶ)。データは `src/content/handbook/*.json` で、形は `tests/handbook.test.ts` が検査する)、コマンド (`/commands/`、`/commands/<id>/`。問題に出てくるコマンドごとに、何をするか・書き方・オプション・中で何が起きるか (どの API の要求になり、どの部品が動くか)・送る API の要求・実行の例と出力・kubectl -v で見える要求・実装のソースの抜粋 (版のタグと行つき)・出てくるレッスン・公式リファレンス。何をするか・書き方・オプションは `src/content/commands.json` (答えたあとの「出てきたコマンド」と共通)、残りは `src/content/commandPages/*.json`。形と、家のクラスタの名前・住所を載せていないことは `tests/commandPages.test.ts` が検査する。出力の例は公式の文書か、家の k3s で読むだけのコマンドと --dry-run=server で打ったもの (名前・住所は伏せる)。答えたあとの説明からも飛べる。中身まで書き出した HTML にして sitemap に載せる)、似た語の比較表 (`/compare/`、`/compare/<id>/`。試験で取り違えやすい語の組ごとに、観点を並べた表・取り違えやすい点・違いが見えるコード・出典。データは `src/content/compare.json` で、形は `tests/compare.test.ts` が検査する。列の語は用語集の語に結び、用語集の語からも「似た語と比べる」で飛べる。表まで書き出した HTML にして sitemap に載せる)、このサイトについて (`/about/`)。計画との差は、週の終わりの日曜を過ぎた週の問題のレッスンで数え、実習は遅れに入れず残りの数だけ添える。スマホ (768px 未満) は上の帯と下のタブ、PC は左の一覧と右の欄にする。URL は `#` の無い形 (`/kcna-dojo/handbook/<id>/` など) で、History API で切り替える (`src/lib/route.ts`)。検索エンジンは `#` の後ろを別のページとして扱わないため。前の形の `#/...` の URL は、開いたときに同じページの新しい URL へ置き換える
- 軽さ: ホーム以外の画面は、開いたときに読む (`src/lib/screens.ts`)。ハンドブックと用語集のデータも、その画面の分と一緒に読む。週の問題のファイルは、ホームと本体では `?light` を付けて問題を id・形・問題文だけにした軽い形で読み (`vite.config.ts` の `lightLessons`、`src/content/curriculum.ts`)、選択肢・正解・解説・出典までの全文は `src/content/lessons.ts` から、レッスン・復習・模擬試験・説明のページを開いたときに読む。最初に開いた画面は先に読んでから描き、サイトの中で移るときは読み終えるまで前の画面を出したままにする (白い画面を挟まない)。画面の部品を読めなければページごと 1 回だけ読み直す (`reloadOnce`)。答えたあとの読み直す先などの後から読む部品 (`React.lazy`) は `src/components/LoadBoundary.tsx` の `LazyPart` で受け止め、読めなければその部品だけ出さない。画面の全体は `LoadBoundary` で受け止め、「画面を読み込めませんでした / 読み直す」を出す (新しい版を出したあとの開いたままのタブで古いチャンクが 404 になっても、白紙にしない。`npm run e2e` が見る)。トップが最初に読む JS (script と modulepreload) の gzip -9 の合計 (250KB まで。2026-11-22 に 326KB から 240KB にした) と、ハンドブック・用語集・説明のページ・模擬試験用の問題・比較表・コマンドのページ・週の問題の全文を最初に読まないことを `npm run e2e` が見張る
- 検索に載る作り: `npm run build` の最後に `scripts/prerender.mjs` が、ページごとの `index.html` (題名・説明・canonical・画面と同じ中身の本文。問題の答えは書かない) と `sitemap.xml` を `dist` に書き出す。書き出したページの URL は、直接開いても 200 で返る (書き出していない URL は 404)。第 1 週はトップと同じ画面なので、リンクはトップを指す。復習・進捗・設定は noindex で sitemap に入れない。用語の 1 語ずつのページは、中身が短いので canonical を用語集の一覧に向ける。題名はトップだけ「クラネイ — KCNA-JP 対策」で、ほかは「ページの名前 | クラネイ」(`src/lib/pageTitle.ts` の `withSite`。画面の document.title と同じ関数)。35 字を超えるときは名前だけにし、名前だけでも超えるものはデータに短い名前 `short` を持つ。検索に載るページ (noindex でなく canonical が自分) は、本文の頭に見えるパンくず (トップ › 一覧か週 › ページ。第 1 週のレッスンはトップの下) と、同じ階層の BreadcrumbList の JSON-LD を持ち (画面も `src/components/Crumbs.tsx` で同じ階層のパンくずをトップから出す。ハンドブックの段とコマンドの道具は、画面ではリンクの無い項目として間に出す。レッスンを解く画面は上の帯で週へ戻るので出さない)、ハンドブック・コマンド・比較表のページは TechArticle、用語集は DefinedTermSet、レッスンは LearningResource も持つ。WebSite の JSON-LD はトップだけ。レッスンの本文には、答える前に画面に出るもの (問題文・コード・選択肢・候補) を書き、選択肢と候補は文字の順に並べる (データの並びは正解が前に寄るため)。題名が重ならないこと・35 字以内・構造化データ・パンくず・h2・模擬試験とこのサイトについてと全レッスンの本文 400 字以上を `tests/pages.test.ts` が見る。robots.txt はドメインの直下 (maco165.github.io リポジトリ) にしか置けないので、そこの `Sitemap:` の行からこの sitemap を指す
- 問題データは JSON で同梱する。足すたびに `npm run check:content` で形を検査する
- 進捗は `src/lib/progress.ts` の関数が読み書きする。関数は保存先と時刻を引数で受け取るので、テストで差し替えられる
- AI に聞くリンクは、問題文を入れた Claude / ChatGPT を新しいタブで開くだけで、サイトからは何も送らない

## 学習の流れ

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': '-apple-system, Segoe UI, Roboto, sans-serif', 'primaryColor': '#FFFFFF', 'primaryTextColor': '#0A1317', 'primaryBorderColor': '#CCD3DB', 'lineColor': '#4E606F', 'tertiaryColor': '#F1F4F7'}}}%%
flowchart TD
  home[ホーム: 週のレッスンの一覧] -->|開始| q[問題を 1 問ずつ解く]
  q -->|確かめる| fb{正解?}
  fb -->|正解| ok[解説・実行結果の例]
  fb -->|不正解| ng[選んだものがなぜ違うか + 解説]
  ok --> next{最後の問題?}
  ng --> next
  next -->|いいえ| q
  next -->|はい| done[完了画面: 正答数・XP・今日の目標]
  done -->|一覧へ戻る| home
  home -->|実習| lab[手順を確かめて印を付ける] -->|完了にする| done
  q -.->|AI にヒントを聞く| ai[Claude / ChatGPT]
  classDef success fill:#D6EDD9,stroke:#0D8626,color:#09441F;
  classDef error fill:#F9D3D8,stroke:#D31130,color:#7B0210;
  classDef accent stroke:#0064E0,stroke-width:2px;
  class ok success;
  class ng error;
  class home,done accent;
```

| 決まり | 中身 |
|---|---|
| 次のレッスン | まだ終えていない最初のレッスンだけが「開始」。ほかのレッスンもいつでも開ける |
| 先に読む (`src/content/curriculum.ts` の `read`) | 週の一覧の頭に、その週で先に読むハンドブックのトピックへのリンクを出す。レッスンは問題から始まり導入の本文を持たないので、初めての人の入口にする。読まなくてもレッスンは開ける。ホームはハンドブックのデータを読まないので、週ごとにトピックの id と短い呼び名だけを持ち、`tests/preRead.test.ts` が見張る: トピックが実在して試験の範囲であること・呼び名が題名の頭であること・その週のレッスンを練習に持つこと・試験の範囲の 13 トピックがどれかの週に入ること・どのレッスン (実習も) も自分の週のトピックの練習に入ること。学び方 (初めての人は読んでから、触ったことがある人は解いてから読み直す) は `/guide/` の「学び方」に書く |
| 採点 (`src/lib/grade.ts`) | 穴埋めは前後の空白を無視し、間の空白の並びを 1 つにして比べる。大文字と小文字は区別する (kubectl も YAML の kind も区別するため)。`answers` のどれかに一致すれば正解 |
| 選択肢の並び (`src/lib/shuffle.ts`) | 4 択と穴埋めの候補は、レッスンを開くたび・もう一度解くたびに混ぜる。A〜D は画面の並びで振り、採点と記録は選択肢の id で行う。位置に意味がある問題は `fixedOrder: true` で固定する |
| XP | 1 問正解で 3 XP、実習の完了で 10 XP。レッスンを最後まで解いたときに入る |
| 今日の目標 | 30 XP |
| 連続日数 | レッスンを終えた日が前日の翌日なら 1 増え、1 日以上空くと 1 に戻る。今日も昨日も学んでいなければ 0 と出す |
| 出てきたコマンド (`src/lib/commandRefs.ts`) | 答えたあと、解説の下に、問題 (問題文・コード・選択肢) に出てくるコマンドの説明を出す。何をするか・書き方・その問題で使っているオプションと、公式リファレンスへのリンク。説明は `src/content/commands.json` (公式リファレンスから書く)。サブコマンドはいちばん長く一致するものに当て、`--` より後ろ (コンテナの中のコマンド) は読まない。問題に出てくるコマンドとオプションのすべてに説明があることを `tests/commandRefs.test.ts` が検査する。答える前には出さない (答えの手がかりになるため)。データは最初に読む JS に入れず、問題を開いたときに先に読む (答えてから読むと「次へ」が下へずれるため)。コマンドが 1 つなら開いて、2 つ以上なら閉じて出し、模擬試験の結果では閉じて出す。誤りの選択肢に出てくる無いコマンド・無い指定は、別の札で「無い」と出す |
| 読み直す (`src/lib/readMore.ts`) | 答えたあと、「次へ」の下に、その問題に関係するハンドブックのトピック (最大 3 つ) と、問題に出てくる用語集の語へのリンクを出す。トピックは点で選ぶ: そのレッスンを練習に持つトピック、問題に出てくる語 (Pod・ノード・kubectl のようにどこにでも出る語は除く) が出てくるトピック、問題の分野の範囲内のトピックに点を足し、範囲外は下げる。模擬試験の結果には、合格の目安 (75%) に届かなかった分野のトピックを出す。ハンドブックと用語集のデータは答えたあとに読む |
| AI に聞く (`src/lib/askAi.ts`) | 問題文・コード・候補・選択肢を `https://claude.ai/new?q=` と `https://chatgpt.com/?q=` に入れて開く。答える前は正解を入れずヒントを頼み、答えたあとは自分の答えと正解を添えて説明を頼む。実習は手順ごとに出し、実習の題名・手順の文・コマンド・うまくいくと見えるものを入れて、コマンドの説明を頼む (エラーはサイトから取れないので、開いた先で続けて貼ってもらう文にする)。1,500 字で切る。Claude と ChatGPT には同じ文が入る。ほかの AI (Gemini など) に貼れるよう、同じ文を写す「プロンプトをコピー」のボタンも置く (`src/lib/copyText.ts`。クリップボードが使えなければ、文を選べる形で見せる。実習の手順では窓で見せる)。PC は 1 行、スマホは見出しの下に 3 つのボタンを縦に並べ、左端をそろえる |

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

模擬試験だけに使う初見の問題は `src/content/exam/*.json` に同じ形で置く。週を持たないので `week` は 0 にし、レッスンは id が `x-` で始まる `quiz` だけにする (検査が落とす)。模擬試験と復習の画面を開いたときにだけ読み、最初に読む JS には入れない。復習のバッジの数は、データを読まずに id の `x-` で数える。

| 種類 | 必須の欄 | 説明 |
|---|---|---|
| 共通 | `id` `type` `prompt` `explanation` `source` | `id` は全体で重複しない。`source` は確かめた公式の文書の https の URL |
| `fill` (穴埋め) | `language` (`bash` / `yaml` / `dockerfile`)、`code`、`answers` | `code` に `{{blank}}` をちょうど 1 つ。`candidates` (押して入れる候補。重複しない)、`output` (正解のあとに出す実行結果の例)、`wrongNotes` (候補ごとのなぜ違うか) は任意 |
| `choice` (4 択) | `choices` (`id` と `text`)、`answer` | `answer` は選択肢の `id`。`why` (なぜ違うか)、`code` (出力を読む問題の出力)、`fixedOrder` (混ぜない) は任意。選択肢の文に「A」「B」など位置を書かない |
| 実習 (`kind: lab`) | `goal` (この実習で分かること)、`needs` (用意するもの)、`steps` (`text`、任意で `command`・`expect`・`stuck`)、`source` | 初めての人が進められるよう、頭に「始める前に」(分かること・用意するもの・k3s の入れ方へのリンク・その週の先に読むトピック) を出す。`command` のある手順には `expect` (うまくいくと見えるもの) が必須で、`stuck` (つまずいたら最初に見るところ) は任意。手順の文は切らずに全部出し、コマンドは改行をそのまま出す (`&&` でつなぐ長い 1 行は行に分けて書く)。全部の手順に印を付けると完了にできる |
| レッスン | `id` `title` `summary` `domain` | `quiz` は 5 問以上。`domain` は試験の 4 分野のどれか |

週の並び・日付・「説明できるようにすること」は `src/content/curriculum.ts` (問題は軽い形で読む。全文は `src/content/lessons.ts`)。

問題は公式の文書 (kubernetes.io・docs.k3s.io・opencontainers.org・docs.docker.com) で確かめた内容から書き起こす。実際の試験問題は写さない。

## 開発

```bash
npm ci
npm run dev            # 手元で開く
npm run check:content  # 問題データの検査
npm test               # 採点・進捗・AI のリンク・データ検査・ファビコンのテスト (vitest)
npm run e2e            # 組み立ててブラウザで通しの検査 (Playwright。390 幅と 1280 幅)
npm run build          # 型検査と本番の組み立て
npm run readme:images  # README の見出しと画面の画像を作り直す
```

- テーマ (`src/themes/kcna/kcnaTheme.ts`) はほかのテーマを受け継がず、Astryx の core の既定のトークンをそのまま使い、字体だけシステムの字体にしている (デザイン案が core の既定で描かれているため)。変えたら `npm run astryx -- theme build src/themes/kcna/kcnaTheme.ts` の出力も一緒にコミットし、README の見出しの色 (`scripts/readme-images.mjs` の `TOKENS`) と図の色 (上の `%%{init}%%`) も同じ値に合わせる
- ファビコンの正本は `public/favicon.svg` (強調色の青の角丸の四角に `>_`)。直したら `node scripts/favicons.mjs` で PNG (32px と apple-touch-icon の 180px) を作り直し、一緒にコミットする
- Astryx の部品の使い方は `npm run astryx -- component <名前>` で、入っている版の文書を読む
- main へのマージで GitHub Actions が検査・テスト・組み立てを通し、Pages に配る。PR では配らずに検査だけ走る。e2e と画像の作り直しはブラウザが要るので手元で走らせる

## ライセンス

MIT

Kubernetes と KCNA は The Linux Foundation の商標です。このサイトは The Linux Foundation・CNCF とは関係ありません。
