# 研修医レクチャー（スライド配信 PWA）

研修医向けレクチャーのスライドを、ブラウザでめくって見せるための静的サイトです。GitHub Pages で `docs/` を配信します。

- 一覧：`index.html`
- ビューア：`viewer.html?id=<id>`
- インストール：iPhone・iPad は Safari の共有メニュー →「ホーム画面に追加」。Mac の Chrome はアドレスバーのインストールボタン

## ビューアの操作

| 操作 | キー | タッチ・ボタン |
|---|---|---|
| 次へ・前へ | → ← / Space / PageDown・PageUp | 左右にスワイプ。画面の右 7 割をタップで次、左 3 割で前 |
| 最初・最後 | Home / End | |
| 一覧表示 | G | 田の字ボタン |
| ノート | N | 三本線ボタン（下にノートが開く） |
| 全画面 | F | 四隅のボタン |
| 発表者ビュー | P | 窓のボタン（画面が広いときだけ出る） |
| オフライン保存 | | 下向き矢印のボタン（保存済みは緑） |

発表者ビューでは、現在のスライド・次のスライド・ノート・経過時間が出ます。「スクリーン用ウィンドウ」でスライドだけのウィンドウが開くので、プロジェクター側の画面に移して全画面（F）にします。2 つのウィンドウは同じ端末内で同期します（BroadcastChannel）。

講義中は画面スリープを止めます（Wake Lock に対応したブラウザのみ）。会場の通信が不安なときは、事前に「オフライン保存」を押しておきます。

## スライドを追加・更新する

```bash
cd ~/orca/projects/lecture_slides
export UV_CACHE_DIR=~/scratch/uv-cache

# PPTX をそのまま（LibreOffice で PDF 化。和文は Noto で代替される）
uv run tools/publish_deck.py path/to/deck.pptx --id peep-heart-lung \
  --title "PEEP は「循環治療」でもある" --subtitle "…" --date 2026-09-27

# PowerPoint で書き出した PDF を使う（見た目が正確）。ノートは PPTX から取る
uv run tools/publish_deck.py deck.pdf --id peep-heart-lung --title "…" --notes-from deck.pptx

# 削除
uv run tools/publish_deck.py --remove peep-heart-lung

git add docs && git commit -m "Add/update deck: peep-heart-lung" && git push
```

同じ `--id` で実行すると上書きします。画像の URL に版（PDF のハッシュ）が付くので、更新後に古い画像が残ることはありません。

変換すると `docs/decks/<id>/` に次ができます。

- `s01.webp`…：1920 px のスライド
- `t01.webp`…：480 px のサムネイル
- `deck.json`：各ページの本文テキスト（代替テキスト用）とノート

`docs/decks.json` はスライド一覧です。

## 必要なもの（yakurinonopore）

- LibreOffice：`~/scratch/libreoffice/`（AppImage を展開したもの。PPTX を渡すときだけ使う。場所は `SOFFICE` 環境変数で変えられる）
- poppler-utils（`pdftoppm`・`pdftotext`・`pdfinfo`）：導入済み
- Python の依存はスクリプト冒頭の PEP 723 メタデータで `uv run` が入れる

## 公開範囲

GitHub Pages（無料プラン）は URL を知っていれば誰でも見られます。`noindex` を付けて検索エンジンには載らないようにしていますが、非公開ではありません。患者情報や未発表データは載せないでください。

## アプリ本体を変えたとき

`docs/sw.js` の `APP = "app-vN"` の番号を上げます。上げないと、インストール済みの端末に古い画面が残ります。
