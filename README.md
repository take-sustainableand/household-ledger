## Sustainable Household Ledger

Papa / Mama が共同で利用することを前提とした、クレジットカード明細ベースの家計簿 Web アプリです。

### 準備（ローカル開発）

1. 依存インストール

```bash
npm install
```

2. Supabase プロジェクトの作成とスキーマ適用

- Supabase ダッシュボードで新規プロジェクトを作成し、SQL Editor で `supabase/schema.sql` の内容を実行します。
- Auth のメール確認フローはお好みで設定してください（ローカル検証では「メール確認なし」が簡単です）。

3. 環境変数の設定

プロジェクトルートに `.env.local` を作成し、以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=あなたの Supabase プロジェクト URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon 公開キー
```

4. 開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

### GitHub 連携 & Vercel デプロイ

1. GitHub リポジトリを作成し、このディレクトリを push します。

```bash
git init
git add .
git commit -m "Initial sustainable household ledger app"
git branch -M main
git remote add origin https://github.com/<your-account>/<repo>.git
git push -u origin main
```

2. Vercel で新規 Project を作成

- Import Project から上記 GitHub リポジトリを選択します。
- Environment Variables に以下を設定します。
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. デプロイ

- Vercel 上で Deploy を実行すると、本番 URL が発行されます。
- 以後は `main` ブランチへの push で自動デプロイされます。

### セキュリティ上の注意

- Supabase の RLS を必ず有効化し、本リポジトリの `supabase/schema.sql` に含まれるポリシーを適用してください。
- サービスロールキー（service_role）は絶対にフロントエンド（ブラウザ）側に露出させないでください。
- 本アプリは Supabase の anon key + RLS による保護を前提としています。
