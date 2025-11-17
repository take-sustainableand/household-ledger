"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Statement = {
  id: string;
  year: number;
  month: number;
  source: string;
};

type Transaction = {
  id: string;
  posting_date: string;
  amount: number;
  description: string | null;
  user_tag: "papa" | "mama" | "shared";
};

async function getCurrentHouseholdId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users_households")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.household_id ?? null;
}

export default function TransactionsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | "">(
    ""
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tagFilter, setTagFilter] = useState<"all" | "papa" | "mama" | "shared">(
    "all"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const hid = await getCurrentHouseholdId();
      if (!hid) {
        setError("世帯情報が取得できませんでした。ログイン状況を確認してください。");
        return;
      }
      setHouseholdId(hid);
      const { data, error: stmtError } = await supabase
        .from("statements")
        .select("id, year, month, source")
        .eq("household_id", hid)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (stmtError) {
        setError(stmtError.message);
        return;
      }

      const list = (data ?? []) as Statement[];
      setStatements(list);
      if (list.length > 0) {
        setSelectedStatementId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedStatementId) {
        setTransactions([]);
        return;
      }
      setLoading(true);
      const { data, error: txError } = await supabase
        .from("transactions")
        .select("id, posting_date, amount, description, user_tag")
        .eq("statement_id", selectedStatementId)
        .order("posting_date", { ascending: true });
      setLoading(false);
      if (txError) {
        setError(txError.message);
        return;
      }
      setTransactions((data ?? []) as Transaction[]);
    })();
  }, [selectedStatementId]);

  const handleTagChange = async (id: string, tag: "papa" | "mama" | "shared") => {
    const previous = transactions;
    setTransactions((current) =>
      current.map((t) => (t.id === id ? { ...t, user_tag: tag } : t))
    );
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ user_tag: tag })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setTransactions(previous);
    }
  };

  const filteredTransactions =
    tagFilter === "all"
      ? transactions
      : transactions.filter((t) => t.user_tag === tagFilter);

  const totalAmount = filteredTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">明細一覧 & 利用者タグ付け</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">対象月の選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-3 items-end">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                明細
              </label>
              <select
                value={selectedStatementId}
                onChange={(e) => setSelectedStatementId(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {statements.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.year}/{String(s.month).padStart(2, "0")} ({s.source})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                タグフィルタ
              </label>
              <select
                value={tagFilter}
                onChange={(e) =>
                  setTagFilter(e.target.value as typeof tagFilter)
                }
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">すべて</option>
                <option value="papa">Papa</option>
                <option value="mama">Mama</option>
                <option value="shared">共通</option>
              </select>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <span>件数: {filteredTransactions.length} 件</span>
              <br />
              <span>
                合計: {totalAmount.toLocaleString("ja-JP")}
                円
              </span>
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            明細 ({filteredTransactions.length} 件)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground">読み込み中...</p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              表示できる明細がありません。
            </p>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-[11px]">
                  <th className="px-2 py-2 text-left font-medium">日付</th>
                  <th className="px-2 py-2 text-left font-medium">ご利用先</th>
                  <th className="px-2 py-2 text-right font-medium">金額</th>
                  <th className="px-2 py-2 text-center font-medium">タグ</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {t.posting_date}
                    </td>
                    <td className="px-2 py-1 align-top">
                      <div className="max-w-xs truncate text-ellipsis">
                        {t.description}
                      </div>
                    </td>
                    <td className="px-2 py-1 align-top text-right whitespace-nowrap">
                      {Number(t.amount).toLocaleString("ja-JP")}円
                    </td>
                    <td className="px-2 py-1 align-top">
                      <div className="flex items-center gap-2 justify-center">
                        <Button
                          type="button"
                          variant={t.user_tag === "papa" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleTagChange(t.id, "papa")}
                        >
                          Papa
                        </Button>
                        <Button
                          type="button"
                          variant={t.user_tag === "mama" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleTagChange(t.id, "mama")}
                        >
                          Mama
                        </Button>
                        <Button
                          type="button"
                          variant={
                            t.user_tag === "shared" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleTagChange(t.id, "shared")}
                        >
                          共通
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


