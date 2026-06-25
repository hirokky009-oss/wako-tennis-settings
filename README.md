# テニスコート監視 設定 Web UI（Vercel）

監視ツール（`wako-tennis-check`）の `config.json` を、**スマホ／PCのブラウザから**変更するための設定ページです。
保存すると Vercel のサーバー処理が GitHub 上の `config.json` を直接書き換え（コミット）ます。
監視ツール本体（GitHub Actions）は次回実行時にその `config.json` を読んで動きます。

```
[スマホ/PC] → 設定ページ（パスワード保護）
            → /api/config が GitHub の config.json を読み書き
            → 監視ツール（GitHub Actions）が config.json を読んで巡回・通知
```

## 変更できる項目
- 施設のオンオフ
- 対象曜日（土・日・祝・平日）
- 通知時間帯（◯時〜◯時開始の枠）
- チェック間隔（◯時間ごと）
- 監視期間（◯日先まで）
- メール通知 / LINE通知の **個別オンオフ**

---

## 構成

| パス | 役割 |
|------|------|
| `public/index.html` | 設定画面（パスワード保護・スマホ対応） |
| `api/config.js` | GitHub の config.json を読み書きするサーバー処理 |
| `package.json` | Node ランタイム指定 |

---

## セットアップ手順（初回のみ）

### 1. このフォルダを GitHub の新規リポジトリにする

```
cd wako-settings
git init
git add .
git commit -m "Initial commit: tennis settings web UI"
```
GitHub で空のリポジトリ（例: `wako-tennis-settings`）を作り、表示される手順に従って push する。

> ⚠️ ここに認証情報は入れない。トークン類は Vercel の環境変数に入れる（後述）。

### 2. GitHub のトークン（PAT）を発行する

設定ページが config.json を書き換えるために、**監視ツールのリポジトリ**（`hirokky009-oss/wako-tennis-check`）への書き込み権限が必要。

1. GitHub → 右上アイコン → **Settings** → 左下 **Developer settings**
2. **Personal access tokens → Fine-grained tokens** → **Generate new token**
3. 設定:
   - **Repository access**: Only select repositories → `wako-tennis-check` を選択
   - **Permissions → Repository permissions → Contents**: **Read and write**
   - 有効期限はお好みで（切れたら通知設定が保存できなくなるので、長め推奨）
4. 生成された `github_pat_...` を控える（後で Vercel に入れる。1度しか表示されない）

### 3. Vercel にデプロイする

1. [vercel.com](https://vercel.com) にログイン → **Add New… → Project**
2. 手順1で作った `wako-tennis-settings` リポジトリを **Import**
3. Framework Preset は **Other**（自動検出のままでOK）。Build 設定は触らなくてよい
4. **Environment Variables** に以下を登録してから Deploy:

| Name | Value | 説明 |
|------|-------|------|
| `GITHUB_TOKEN` | `github_pat_...` | 手順2で発行したトークン |
| `GITHUB_REPO` | `hirokky009-oss/wako-tennis-check` | 監視ツールのリポジトリ |
| `GITHUB_BRANCH` | `master` | ブランチ名（このリポジトリの既定は `master`） |
| `CONFIG_PATH` | `config.json` | 設定ファイルのパス |
| `SETTINGS_PASSWORD` | 好きなパスワード | 設定ページを開く合言葉 |

5. **Deploy** を押す。完了後に発行される URL（例: `https://wako-tennis-settings.vercel.app`）をスマホのホーム画面に追加すると便利。

### 4. 動作確認
1. URL を開く → パスワードを入力
2. 現在の設定が表示されれば読み込み成功
3. どこか変更して「設定を保存」→ GitHub の `config.json` のコミット履歴に反映されていればOK

---

## 監視ツール側で必要な対応

このUIで増えた設定項目（`check_interval_hours` / `notifications.email_enabled`）を
監視ツール本体が解釈できるよう、`check_tennis.py` 側も合わせて更新済み（別ブランチ）。
詳細は監視ツールリポジトリ側の変更を参照。

## トラブルシューティング

| 症状 | 確認 |
|------|------|
| パスワードが通らない | Vercel の `SETTINGS_PASSWORD` と入力値が一致しているか |
| 「GitHub読み込み失敗」 | `GITHUB_TOKEN` の権限（Contents: Read and write）・`GITHUB_REPO` の綴り |
| 保存しても反映されない | 監視ツールの GitHub Actions が次回実行されるまで待つ（即時ではない） |
| 401 が返る | トークンの有効期限切れ／リポジトリ選択漏れ |
