# lecture_slides

研修医向けレクチャーのスライドを GitHub Pages（`docs/`）で配信する静的 PWA。使い方は README.md。

## スライドを追加するとき

1. スライドの作成は各プロジェクト（例：`~/orca/projects/education_heart`）で行う。このリポジトリには変換後の画像だけを置く（PPTX・図の元データは置かない）
2. `UV_CACHE_DIR=~/scratch/uv-cache uv run tools/publish_deck.py <pptx|pdf> --id <kebab-case> --title … --subtitle … --date YYYY-MM-DD`
   - Claude Code のサンドボックス内では LibreOffice が UNIX ソケットを作れず、何も出力せずに失敗する。このリポジトリへの書き込みもサンドボックス外になるので、サンドボックス外で実行する
   - ユーザーが PowerPoint で書き出した PDF があれば、それを優先する（和文フォントが正確）。ノートは `--notes-from <pptx>`
3. 変換結果を目で確かめる：`docs/decks/<id>/s01.webp` など数枚を開く。`deck.json` のノート件数と、スライド枚数が合っているかも見る
4. commit → push で公開される。push は公開操作なので、実行前にユーザーの確認を取る

## 公開範囲の制約

- URL を知っていれば誰でも見られる。患者を特定できる情報、未発表データ、著作権上配布できない図は載せない
- `noindex` は検索避けであって、アクセス制限ではない

## アプリ本体

- `docs/index.html`・`catalog.js`：一覧
- `docs/viewer.html`・`viewer.js`：ビューア。`?mode=presenter`（発表者ビュー）、`?mode=audience`（スクリーン用）。同じ端末内の同期は BroadcastChannel
- `docs/sw.js`：Service Worker。本体は事前キャッシュ、`*.json` はネットワーク優先、スライド画像はキャッシュ優先。本体を変えたら `APP` の版を上げる
- 外部 CDN・解析スクリプトは使わない（オフラインで動くこと、閲覧者を追跡しないことを優先）

## 動作確認

`~/scratch/pwvenv/bin/python tests/e2e.py <出力先>`（サンドボックス外で）。ページ送り・一覧・ノート・発表者ビューとスクリーン用の同期・オフライン保存と再表示・スマホ幅・スワイプを 20 項目で確認し、スクリーンショットを出力先に残す。アプリ本体を変えたら必ず回す。

ブラウザはヘッドレス Chrome（`~/scratch/chrome/`、chrome-headless-shell）。Playwright 同梱のブラウザは Ubuntu 20.04 非対応なので、`executable_path` に chrome-headless-shell を渡している。
