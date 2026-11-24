<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/banner-dark.png">
  <img alt="クラネイ: KCNA-JP 対策。コマンドと YAML の穴埋め・4 択を、週ごとのレッスンで。進捗はブラウザの中だけに残ります" src="docs/images/banner-light.png">
</picture>

**クラネイ**は、Kubernetes の入門資格 KCNA-JP のための、無料の学習サイトです (非公式)。

**サイト: https://maco165.github.io/kcna-dojo/**

登録は要りません。学習の記録は、お使いのブラウザの中だけに残ります。

## できること

- **レッスン**: コマンドや YAML の穴埋めと 4 択を、8 週に分けて解く
- **復習**: 間違えた問題が 1・3・7 日後にまた出る
- **模擬試験**: 本番に近い 60 問・90 分
- **ハンドブック**: 実際のコマンドと設定ファイルで、仕組みを読む
- **用語集**: 分からない語をすぐ引く

<table>
  <tr>
    <td width="33%"><img alt="ホーム: 週のレッスンの一覧と今日の目標" src="docs/images/home-phone.png"></td>
    <td width="33%"><img alt="コマンドの穴埋め: 正解と実行結果の例" src="docs/images/fill-phone.png"></td>
    <td width="33%"><img alt="模擬試験: 残り時間と 1 問ずつの解答" src="docs/images/exam-phone.png"></td>
  </tr>
  <tr>
    <td>ホーム</td>
    <td>コマンドの穴埋め</td>
    <td>模擬試験</td>
  </tr>
</table>

<img alt="PC のホーム: 左に週の一覧、本文にレッスンの一覧" src="docs/images/home-pc.png">

## 開発

React と [Astryx](https://github.com/meta/astryx) で作り、GitHub Pages で配っています。

```bash
npm ci
npm run dev    # 手元で開く
npm test       # テスト
npm run build  # 組み立て
```

くわしい作りは [docs/design.md](docs/design.md) にあります。誤りを見つけたら [Issue](https://github.com/maco165/kcna-dojo/issues) で教えてください。

## ライセンス

MIT

問題と説明は公式の文書をもとに書いており、実際の試験問題は載せていません。Kubernetes と KCNA は The Linux Foundation の商標です。このサイトは The Linux Foundation・CNCF とは関係ありません。
