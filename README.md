# KamuiOS

空間コンピューティング時代のWebOS。AR/VR環境で動作する3D空間インターフェースを提供し、ファイルシステムやアプリケーションを物理空間に配置して操作できます。AIツールとの統合により、次世代の作業環境を実現します。

## Setup

### クイックスタート

最速で起動する3ステップ：

```bash
# 1. クローンして移動
git clone https://github.com/dai-motoki/kamuios.git && cd kamuios

# 2. 環境設定
cp env.sample .env
# .envを編集（最低限ANTHROPIC_API_KEYとCLAUDE_MCP_CONFIG_PATHを設定）

# 3. 起動（すべてのサービス + ブラウザ自動起動）
./start_all.sh
```

### 基本セットアップ

KamuiOSは以下の機能を提供します：
- 🎨 **Dynamic Media Gallery** - メディアファイルの動的閲覧・管理
- 🤖 **AI エージェント機能** - Claude APIを使用した高度なAIアシスタント
- 🌐 **3D Directory Graph** - ディレクトリ構造の3D可視化（AR/VR対応）
- 📱 **空間コンピューティング** - AR/VR環境での操作体験

#### 前提条件

- Node.js 18.x 以上
- Python 3.8 以上
- Hugo 0.110.0 以上
- Claude API Key（[Anthropic](https://www.anthropic.com/)から取得）

#### 1. プロジェクトのクローンと環境設定

```bash
# リポジトリをクローン
git clone https://github.com/dai-motoki/kamuios.git
cd kamuios

# 環境設定ファイルをコピー
cp env.sample .env
```

#### 2. .envファイルの設定

`.env`ファイルを編集して必要な設定を行います：

```bash
# 必須設定
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxx  # Claude API キー
CLAUDE_MCP_CONFIG_PATH=/path/to/mcp-config.json  # MCP設定ファイルのパス
SCAN_PATH=/Users/yourname/kamuios/  # メディアファイルのスキャンパス

# オプション設定（デフォルト値あり）
PORT=7777  # Node.jsサーバーのポート
PYTHON_SERVER_PORT=8888  # Python SDKサーバーのポート
```

#### 3. 一括起動（推奨）

すべてのサービスを一度に起動します：

```bash
./start_all.sh
```

これにより以下が自動的に実行されます：
- ✅ Node.js バックエンドサーバー（Dynamic Media Gallery用）
- ✅ Python SDK サーバー（AIエージェント機能用）
- ✅ Hugo 開発サーバー（メインWebインターフェース）
- ✅ ブラウザで http://localhost:1313/ を自動で開く

#### 4. アクセスURL

- **メインインターフェース**: http://localhost:1313/
- **Dynamic Media Gallery**: http://localhost:1313/#dynamic-media-gallery
- **3D Directory Graph**: http://localhost:1313/dir-graph-ar.html
- **Node.js API**: http://localhost:7777/
- **Python SDK API**: http://localhost:8888/

#### 5. サービスの停止

```bash
./start_all.sh stop
# または実行中に Ctrl+C
```


### トラブルシューティング

#### サービスが起動しない場合

```bash
# すべてのサービスを停止してから再起動
./start_all.sh stop
./start_all.sh
```

#### ポートが使用中の場合

```bash
# 使用中のポートを確認
lsof -i :1313  # Hugo
lsof -i :7777  # Node.js
lsof -i :8888  # Python SDK

# プロセスを停止
kill -9 <PID>

# または個別に停止
pkill hugo
pkill node
pkill python3
```

#### ログの確認

```bash
# 各サービスのログを確認
tail -f logs/node_server.log     # Node.jsサーバー
tail -f logs/python_server.log   # Python SDKサーバー
tail -f logs/hugo_server.log     # Hugoサーバー
```

#### 環境変数の問題

```bash
# .envファイルが正しく読み込まれているか確認
cat .env | grep -v '^#'

# MCP設定ファイルの存在確認
ls -la $CLAUDE_MCP_CONFIG_PATH
```

## 主な機能

### Dynamic Media Gallery

メディアファイルを動的に閲覧・管理できるギャラリー機能です。

- 📁 指定ディレクトリ内のメディアファイルを自動スキャン
- 🖼️ 画像・動画・音声ファイルのプレビュー表示
- 🔍 リアルタイム検索とフィルタリング
- 📂 Finderで直接ファイルを開く機能

アクセス: http://localhost:1313/#dynamic-media-gallery

### AI エージェント機能

Claude APIを活用した高度なAIアシスタント機能です。

- 💬 自然言語での対話型インターフェース
- 🛠️ MCP（Model Context Protocol）によるツール統合
- 🎨 画像生成、動画生成、音楽生成などの創作支援
- 📝 コード生成、文書作成、データ分析

円形ダイヤルインターフェースから各種AIツールにアクセスできます。

### Directory Graph 3D AR/VR

ディレクトリ構造を3D空間で可視化し、AR/VR体験ができる機能です。

- 🌍 3次元放射状レイアウトでディレクトリを表示
- 🎨 ファイルタイプごとの色分け表示
- 🖼️ 画像ファイルのサムネイル表示
- 🥽 WebXRによるAR/VR体験

アクセス: http://localhost:1313/dir-graph-ar.html

#### AR/VR体験のセットアップ（オプション）

WebXR（AR/VR）を利用する場合は、HTTPS接続が必要です。ngrokを使用してローカルサーバーを公開します：

```bash
# ngrokのインストール（Homebrewを使用）
brew install ngrok

# または、公式サイトからダウンロード
# https://ngrok.com/download

# ngrokアカウントの作成とトークン設定（初回のみ）
# 1. https://ngrok.com/ でアカウント作成
# 2. ダッシュボードからAuthトークンを取得
# 3. トークンを設定
ngrok authtoken YOUR_AUTH_TOKEN

# Hugoサーバー（ポート1313）をHTTPSで公開
ngrok http 1313

# 表示されるForwarding URLをメモ
# 例: https://abc123.ngrok.app
```

**アクセス方法**
- Web版: http://localhost:1313/dir-graph-ar.html
- ngrok経由（AR/VR用）: https://YOUR_NGROK_URL.ngrok.app/dir-graph-ar.html?backend=/backend
  - 例: https://abc123.ngrok.app/dir-graph-ar.html?backend=/backend

#### 機能詳細

**表示方式**
- **3次元放射状レイアウト**: ルートを中心に、各階層が球面状に広がる
- **画像の自動表示**: 画像ファイルは実際のサムネイルとして表示
- **色分け**: ファイルタイプごとに異なる色で表示
  - 赤: ルートディレクトリ
  - 緑: フォルダ
  - オレンジ: 画像ファイル
  - 紫: 動画ファイル
  - その他: ファイルタイプごとに色分け

**操作方法**

**Web表示**
- マウスドラッグ: 視点の回転
- マウスホイール: ズーム
- ダブルクリック: 視点のリセット

**ボタン機能**
- **リンク表示**: ノード間の接続線の表示/非表示（デフォルト: OFF）
- **START AR**: ARモードで起動（スマートフォン/ARグラス用）
- **START VR**: VRモードで起動（VRヘッドセット用）

#### AR/VR体験

**AR（拡張現実）**
- スマートフォンやARグラスで現実空間にディレクトリ構造を重ねて表示
- カメラ権限が必要
- HTTPS接続が必須（ngrok推奨）

**VR（仮想現実）**
- Meta Quest等のVRヘッドセットで没入型3D空間として体験
- ディレクトリ構造の中を自由に移動可能
- **動作確認済み**: Meta Quest 3

### 技術仕様

- **レンダリング**: Three.js
- **WebXR**: AR/VR体験
- **データソース**: backend/server.jsのディレクトリスキャンAPI
- **対応ファイル形式**:
  - 画像: jpg, jpeg, png, gif, webp, svg
  - 動画: mp4, mov, avi, mkv, webm
  - 音声: mp3, wav, ogg, flac, m4a
  - コード: js, ts, py, rb, go, etc.
  - ドキュメント: pdf, doc, ppt, xls, etc.

### Meta Quest 3での使用方法

1. **Quest 3のブラウザでアクセス**
   - Quest 3を装着してMeta Quest Browserを起動
   - ngrok URLにアクセス（例: https://abc123.ngrok.app/dir-graph-ar.html?backend=/backend）

2. **VRモードに入る**
   - ページが読み込まれたら「START VR」ボタンをクリック
   - 権限の許可を求められたら「許可」を選択

3. **VR内での操作**
   - コントローラーのトリガーでポインティング
   - グリップボタンでつかんで移動
   - スティックで視点の移動

### トラブルシューティング

**ngrok関連**
- `ERR_NGROK_108`: 無料プランの制限に達した場合は、しばらく待つかアカウントをアップグレード
- 接続が遅い場合: 地理的に近いリージョンを選択 `ngrok http 1313 --region=jp`

**Quest 3関連**
- VRボタンが表示されない: ブラウザがWebXR対応か確認（Meta Quest Browserを使用）
- 「START VR」クリック後に何も起こらない: ページをリロードして再試行
- パフォーマンスが悪い: ファイル数が多すぎる場合は、スキャン対象ディレクトリを限定

## アーキテクチャ

### サーバー構成

KamuiOSは2つのサーバーで構成されています：

#### 1. **メインサーバー** (`/server.js`)
- **ポート**: 3001
- **役割**: プロキシサーバー + 静的ファイル配信
- **機能**:
  - `public/`ディレクトリの静的ファイル配信
  - WebXR/AR対応（Permissions-Policy設定）
  - `/backend`へのリクエストをバックエンドサーバーにプロキシ
  - ngrok経由での単一エンドポイント提供

#### 2. **バックエンドサーバー** (`/backend/server.js`)
- **ポート**: 7777
- **役割**: メディアスキャナー + APIサーバー
- **機能**:
  - ディレクトリスキャン（`/api/scan`）
  - メディアファイル一覧取得（`/api/media`）
  - 個別ファイル配信
  - ファイルの追加・削除
  - SCAN_PATH監視

```
[ブラウザ] → [server.js:3001] → [backend/server.js:7777]
                ↓
          静的ファイル配信
          WebXR対応
          プロキシ機能
```

**注意**: 通常は`npm start`でメインサーバーのみ起動すれば、プロキシ経由でバックエンドAPIも利用可能です。

## AIエージェントタスク（右下フローティング）

円形ダイヤルでMCPツールを選択し、Claude Code SDKバックエンドにプロンプトを送るUIを提供します。

### 必要なサーバー

- バックエンド1: メディア・ユーティリティAPI（Node.js）
  - ファイル: `backend/server.js`
  - 既定ポート: `7777`
  - 用途: 画像/動画のオープン、SCAN_PATHのディレクトリを操作

- バックエンド2: Claude Code SDK プロキシ（Python）
  - ファイル: `backend/claude_sdk_server.py`
  - 既定ポート: `8888`
  - 用途: MCP設定を読み込み、`/chat` でClaudeに問い合わせ

### 必須/推奨の環境変数

`.env`（プロジェクトルート推奨）

```
# Node メディアAPI用
PORT=7777                       # backend/server.js の公開ポート
SCAN_PATH=/absolute/path/to/media # 画像/動画などのルート

# Claude Code CLI/SDK 共通
CLAUDE_MCP_CONFIG_PATH=/Users/<you>/kamuicode/mcp-genmedia-go/.claude/mcp-kamui-code.json
CLAUDE_MAX_TURNS=8              # 省略可
CLAUDE_DEBUG=1                  # 省略可（デバッグ出力）
CLAUDE_SKIP_PERMISSIONS=1       # 省略可（CLIのみ）

# Python SDK サーバー用（必要に応じて）
PYTHON_SERVER_HOST=127.0.0.1
PYTHON_SERVER_PORT=8888
CLAUDE_CWD=/Users/<you>/kamuios # 省略可・作業ディレクトリ
```

Shell環境（例: `~/.zshrc`）に以下が必要な場合があります:

```
export ANTHROPIC_API_KEY=sk-ant-...   # または CLAUDE_API_KEY
```

### 起動手順

#### 方法1: 一括起動（推奨）

すべてのサービスを一度に起動し、ブラウザも自動で開きます：

```bash
./start_all.sh
```

機能：
- ✅ Node.js バックエンドサーバー（ポート 7777）
- ✅ Python SDK サーバー（ポート 8888）
- ✅ Hugo 開発サーバー（ポート 1313）
- ✅ ブラウザで http://localhost:1313/ を自動で開く
- ✅ リアルタイムでログを監視

サービスの停止：

```bash
./start_all.sh stop
# または実行中に Ctrl+C でも停止可能
```

ログファイルの場所：
- Node.js: `logs/node_server.log`
- Python SDK: `logs/python_server.log`
- Hugo: `logs/hugo_server.log`

#### 方法2: 個別起動

1) Node メディアAPI

```bash
cd backend
node server.js     # PORT と SCAN_PATH を .env で設定
```

2) Claude SDK Python サーバー

```bash
cd backend
# 環境変数を読み込んで起動
export $(cat ../.env | grep -v '^#' | xargs)
python3 claude_sdk_server.py
# → http://127.0.0.1:8888/health が ok になれば準備完了
```

**注意**: Python SDKサーバーは`.env`ファイルを自動で読み込みません。必ず環境変数を設定してから起動してください。

3) Hugo を起動

```bash
hugo server -D -p 1313
```

4) ブラウザでアクセス

`http://localhost:1313/` を開き、右下のロボットボタンを押すか、タスク入力欄で `/` を入力すると円形ダイヤルが開きます。

### 既定URLの上書き（任意）

クエリで上書きできます：

- `?backend=http://127.0.0.1:7777` … Node API ベースURL
- `?claude=http://127.0.0.1:8888` … Claude SDK サーバー ベースURL

または、グローバル変数で定義：

```html
<script>
  window.KAMUI_BACKEND_BASE = 'http://127.0.0.1:7777';
  window.KAMUI_CLAUDE_BASE = 'http://127.0.0.1:8888';
</script>
```

### トラブルシューティング（AIエージェント）

- 円形ダイヤルにツールが出ない: 
  - `CLAUDE_MCP_CONFIG_PATH` が`.env`ファイルに設定されているか確認
  - 指定されたパスにMCP設定ファイルが存在するか確認
  - `curl http://localhost:8888/mcp` で設定が読み込まれているか確認
- 送信が失敗する: 
  - `ANTHROPIC_API_KEY`（または `CLAUDE_API_KEY`）が有効か確認
  - Pythonサーバーが環境変数を正しく読み込んでいるか確認（起動スクリプトを使用）
  - `/chat` のHTTPステータスを確認
- Finder/エクスプローラが開かない: `SCAN_PATH` が正しい絶対パスか、OSの種類に合った `open/start/xdg-open` が呼べるか確認