# エージェントタスクダッシュボード デスクトップアプリ化調査

## 1. 背景と目的
- 現行のエージェントタスクダッシュボードは Hugo テーマ内のフロントエンド（`themes/kamui-docs/static/js/main.js` など）と、Node.js ベースのバックエンド（`backend/server.js`）が連携する構成で稼働している。
- Web 版と同等の UX を維持しつつ、ローカル PC 上で安定稼働するデスクトップアプリ版を整備し、タスク実行や CLI 連携をより一体的にしたい。

## 2. 現状構成サマリ
- **フロントエンド**: 素の HTML/CSS/JS で構築。巨大な単一 JS (`main.js`) が UI/状態管理/3D ビジュアライザを包含し、`localStorage` を通じて `static/js/taskboard-storage.js` と連携。Three.js や ForceGraph など外部 CDN へ動的にアクセス。
- **バックエンド**: `backend/server.js` が Express 互換の HTTP サーバーとして動作し、Claude CLI・Codex CLI・PTY 制御など大量の OS コマンドを `child_process.spawn` で扱う。WebSocket (`/ws/pty`) や REST API (`/api/claude/*`, `/api/codex/*` 等) を提供。
- **補助サーバー**: ルート直下の `server.js` は静的ファイル配信と `/backend` プロキシを担う。デスクトップ化では Electron 等の内部配信に置き換え可能。
- **依存環境**: Node.js ランタイム、外部 CLI（claude, codex 等）、`.env` による設定が前提。Three.js や flaticon など CDN 由来リソースはオフライン動作を阻害する懸念。

## 3. デスクトップアプリ化で満たしたい要件
1. 既存フロントエンド資産を大幅な改修なしに流用できること。
2. Node.js バックエンドロジック（CLI 実行、PTY、ファイルアクセス）をそのまま or 最小改修で同梱できること。
3. WebGL/Three.js ベースの 3D ビューが安定して描画できること。
4. `localStorage` 相当の永続化と、OS ネイティブ API 呼び出し（ファイルオープン、プロセス実行）が可能であること。
5. Mac (開発機) 優先、将来的には Windows/Linux も視野。
6. パッケージングと自動アップデートの選択肢があること。

## 4. 候補フレームワーク比較
| 観点 | Electron | Tauri | Neutralino.js |
| --- | --- | --- | --- |
| ランタイム | Chromium + Node.js | システム WebView + Rust バックエンド | ミニマル Chromium 相当 WebView + 独自ランタイム |
| Node.js コード再利用 | **〇 そのまま同梱可** | △ Sidecar または rewrite 必須 | × Node API 非対応、外部プロセスでの代替が必要 |
| CLI/PTY 連携 | **〇 child_process が利用可能** | △ Rust 側で `Command` 実装 or プラグインが必要 | △ `child_process` 相当が限定的で拡張が必要 |
| WebGL/Three.js | **〇 Chromium で安定** | △ WebView2/WebKit の差異に注意 | △ 実績が少なく不安定例あり |
| バイナリサイズ | 大 (120MB+ 規模) | 小 (10MB 前後) | 非常に小さい |
| ビルド/CI | 実績豊富、`electron-builder`/`forge` 等充実 | Rust toolchain 必須、学習コスト高 | コミュニティ小規模、手動対応多い |
| 自動更新 | `electron-updater` 等多数 | プラグインで実現可 | 公式機構なし |
| メンテナンス性 | JS/TS で統一できる | Rust/JS の二言語管理 | 独自 API の学習が必要 |
| コミュニティ/情報量 | **非常に多い** | 増加中 (要 Rust 知識) | 限定的 |

### Electron
- 長所: 既存 Node コードと CLI 実行フローをほぼ移植するだけで動作。Chromium により WebGL やレイアウト互換性が高い。調査対象 OSS と構造が近く、デバッグ資産も活かせる。
- 短所: アプリサイズ/メモリフットプリントが大きい。Node 統合を有効にする場合はセキュリティ設定（`contextIsolation` など）が必須。

### Tauri
- 長所: パッケージサイズが最小、Native 感のある API が利用可能。セキュリティデフォルトが厳格。
- 短所: Rust でバックエンドを書き直す or Node サイドカーを管理する必要があり、既存 `backend/server.js` を再利用するには追加実装が多い。WebView により Three.js + WebGL 拡張の挙動検証が不可欠。

### Neutralino.js
- 長所: 非常に軽量でセットアップが速い。
- 短所: Node API や npm モジュールが使えず、バックエンドの大半を再設計する必要。CLI 連携や WebSocket サーバー実装も自前で補うことになり、現行要件とはギャップが大きい。

## 5. 推奨フレームワーク
- **Electron を推奨**。
  - Node.js バックエンドをモジュール化してメインプロセスから起動するだけで、CLI 実行・WebSocket・REST API を維持できる。
  - Chromium ベースのレンダリングにより、現行 Web UI と Three.js 依存の 3D ビジュアライザが期待通り動作する確率が最も高い。
  - 開発チームが既に JavaScript/Node.js 文脈で資産を保有しており、Rust 学習や大規模リファクタリングを避けられる。
  - アプリサイズは増えるが、今回の要件（ローカル開発支援ツール）では許容範囲。

## 6. 以降の実装ステップ案
1. **プロジェクト雛形の作成**
   - `npm init electron-app` などで最小構成を作成し、`BrowserWindow` で既存 `public/index.html` または Hugo ビルド成果物を読み込む。
   - メインプロセスで `contextIsolation:true` とし、レンダラ側とは `preload.js` 経由で安全に連携。
2. **バックエンド統合**
   - `backend/server.js` を Electron メインプロセスに組み込み、`app.whenReady()` 後にサブプロセスとして起動。
   - 既存のポート (`7777`) を維持するか、Electron 内部 IPC 経由へ段階的に移行するかを整理。初期フェーズはローカル HTTP/WS で動かすと移行が容易。
   - `.env` の読み込みを Electron アプリの設定管理に委譲。
3. **リソースのオフライン対応**
   - `main.js` 内で CDN から取得している Three.js / flaticon アイコンをローカルバンドルに差し替え。
   - `loadExternalScriptOnce` をローカル `app://` or `file://` スキーム読み込みに変換。
4. **セキュリティ強化**
   - `preload.js` 経由の API にホワイトリスト方式の関数を用意（例: `window.kamui.invoke('startTask', payload)`）。
   - `nodeIntegration:false` を維持しつつ、必要な Node API だけを公開。
5. **ビルド/配布整備**
   - `electron-builder` または `electron-forge` で `dmg`/`AppImage`/`msi` などを生成。
   - アップデート戦略（手動配布／S3／GitHub Releases）を決定。
6. **テストと運用準備**
   - Claude/Codex CLI を含む実行パスを自動テスト。`backend/tasks-state.json` の永続化と Electron のアプリデータ保存パスを確認。
   - macOS Notarization / Windows Code Sign の方針を決める。

## 7. 今後の課題・検討事項
- Electron 化後もタスク実行には外部 CLI や API キーが必要なため、初回起動時のセットアップ導線（API キー入力、CLI のパス確認）が必要。
- 将来的に Tauri へ移行したい場合は、`backend/server.js` のコア機能を Rust or WASM 化する計画を別途立てる。
- 3D ビュー（ForceGraph + Three.js）のパフォーマンス最適化や、GPU リソース制御が必要になる可能性がある。
- アプリサイズ削減が課題となる場合、`electron-vite` や code splitting を検討。
