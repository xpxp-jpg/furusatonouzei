# ふるさと納税 × 住宅ローン控除 統合シミュレーター（静的サイト版）

このフォルダをそのまま Vercel / Netlify / Cloudflare Pages にデプロイすれば動く、**完全クライアントサイド**の実装です。

## 0) 必要なもの
- Google アカウント（AdSense/Analytics 用）
- GitHub アカウント（ソース保管 & デプロイ用）

## 1) ローカルで確認
1. このフォルダをダウンロードして解凍
2. どこかで簡易ホスティング（例）:
   - macOS: `python3 -m http.server` 実行 → `http://localhost:8000`
3. ブラウザで `index.html` を開いて動作確認

## 2) GitHub へアップ
1. `github.com` でリポジトリを作成（Public でOK）
2. ローカルで以下を実行：
```bash
git init
git remote add origin https://github.com/<YOUR_NAME>/<YOUR_REPO>.git
git add . && git commit -m "initial"
git push -u origin main
```

## 3) デプロイ（3 択）
### A. Vercel（おすすめ）
1. `vercel.com` でログイン → `Add New...` → `Project` → GitHub リポジトリを選択
2. Framework: `Other`（静的）で OK。Build コマンドなし。Output は `/`。
3. デプロイ完了後、`Project Settings > Domains` から独自ドメインを追加

### B. Netlify
1. `app.netlify.com` でログイン → `New site from Git` → GitHub リポジトリを選択
2. Build コマンド空、Publish directory は `/`。デプロイ完了でURLが発行されます

### C. Cloudflare Pages
1. `dash.cloudflare.com` → `Pages` → `Create a project` → `Connect to Git`

## 4) 独自ドメイン（例：お名前.com）
1. ドメイン購入（.com / .jp など）
2. 取得したドメインの DNS を Vercel/Netlify/Cloudflare の指示に従って設定（CNAME/A レコード）
3. 反映後、HTTPS が自動発行されます

## 5) AdSense 申請
1. `index.html` の AdSense スクリプト（`client=ca-pub-XXXX`）を **承認後に** 有効化
2. ルートに `ads.txt` を置き、`pub-XXXXXXXXXXXXXXXX` をあなたの Publisher ID に差し替え
3. プライバシーポリシー/免責/運営者ページを整備（このテンプレ同梱）

## 6) Cookie 同意（簡易）
- 日本向けでも将来的な要請・EEA からのアクセスに備え、Cookie バナーを導入推奨
- まずは非パーソナライズ広告で公開 → 承認後に同意管理ツールでパーソナライズ切り替えが無難

## 7) SEO
- `title/description` を適切化、`sitemap.xml/robots.txt` を Search Console へ登録
- FAQ/HowTo の補助コンテンツを 3–5 本用意

## よくある質問
- **なぜ完全フロントエンド？** → 個人情報を送信せず、審査・運用が楽。サーバー費もゼロ。
- **計算ロジックの更新** → `app.js` 冒頭の定数・関数を更新して再デプロイ。

## 収益シミュレーション（自分で入れるだけ）
- 指標: `収益 = ページビュー(千) × RPM(円)`
- 例: 月 30,000 PV × RPM 500 円 = **15,000 円/月**
- RPM はサイト品質/広告位置/季節で大きく変動します。自身の実績をもとに調整してください。
