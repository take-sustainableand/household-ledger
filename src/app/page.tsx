export default function Home() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
            パパとママで共有するセキュアな家計ダッシュボード
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            毎月届くクレジットカード明細（CSV）をアップロードするだけで、
            世帯全体・Papa/Mama/共通の支出を自動で集計・可視化します。
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">
            次のステップ
          </p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Supabase プロジェクトを作成し、環境変数を設定</li>
            <li>メールアドレスで Papa / Mama のアカウントを登録</li>
            <li>家計グループを共有して CSV をアップロード</li>
          </ol>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            1. 明細アップロード
          </p>
          <p className="mt-2">
            カード会社からダウンロードした CSV をアップロードすると、
            当月の明細が Supabase に登録されます。
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            2. 利用者タグ付け
          </p>
          <p className="mt-2">
            各明細行に対して Papa / Mama / 共通 をチェックすることで、
            誰の支出かを簡単に整理できます。
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            3. 集計 & コメント
          </p>
          <p className="mt-2">
            月別トレンド・費目内訳・タグ別積み上げグラフを表示し、
            そこに対してメモや振り返りコメントを残せます。
          </p>
        </div>
      </section>
    </div>
  );
}
