"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type Comment = {
  id: string;
  content: string;
  created_at: string;
};

type TransactionAggRow = {
  amount: number | null;
  user_tag: "papa" | "mama" | "shared" | null;
  statement: { year: number; month: number }[] | null;
  category: { name: string | null }[] | null;
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

export default function AnalyticsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<
    { ym: string; total: number; papa: number; mama: number; shared: number }[]
  >([]);
  const [rawRows, setRawRows] = useState<TransactionAggRow[]>([]);
  const [selectedYm, setSelectedYm] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
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
      setLoading(true);

      const { data, error: aggError } = await supabase
        .from("transactions")
        .select(
          "amount, user_tag, statement:statements(year, month), category:categories(name)"
        )
        .eq("household_id", hid);

      setLoading(false);
      if (aggError) {
        setError(aggError.message);
        return;
      }

      const rows = (data ?? []) as TransactionAggRow[];
      setRawRows(rows);

      const map = new Map<
        string,
        { total: number; papa: number; mama: number; shared: number }
      >();

      rows.forEach((row) => {
        const stmt = row.statement?.[0];
        if (!stmt) return;
        const ym = `${stmt.year}-${String(stmt.month).padStart(2, "0")}`; // 明細の支払月
        const amt = Number(row.amount || 0);
        if (!map.has(ym)) {
          map.set(ym, { total: 0, papa: 0, mama: 0, shared: 0 });
        }
        const current = map.get(ym)!;
        current.total += amt;
        if (row.user_tag === "papa") current.papa += amt;
        else if (row.user_tag === "mama") current.mama += amt;
        else current.shared += amt;
      });

      const monthly = Array.from(map.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([ym, v]) => ({ ym, ...v }));

      setMonthlyData(monthly);
      if (monthly.length > 0) setSelectedYm(monthly[monthly.length - 1].ym);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!householdId || !selectedYm) {
        setComments([]);
        return;
      }
      const { data, error: commentError } = await supabase
        .from("comments")
        .select("id, content, created_at")
        .eq("household_id", householdId)
        .eq("scope_type", "month")
        .eq("scope_key", selectedYm)
        .order("created_at", { ascending: false });

      if (commentError) {
        setError(commentError.message);
        return;
      }
      setComments((data ?? []) as Comment[]);
    })();
  }, [householdId, selectedYm]);

  const selectedMonthData = useMemo(
    () => monthlyData.find((m) => m.ym === selectedYm) ?? null,
    [monthlyData, selectedYm]
  );

  const categoryData = useMemo(() => {
    if (!selectedYm) return [];
    const map = new Map<
      string,
      { category: string; total: number; papa: number; mama: number; shared: number }
    >();

    rawRows.forEach((row) => {
      const stmt = row.statement?.[0];
      if (!stmt) return;
      const ym = `${stmt.year}-${String(stmt.month).padStart(2, "0")}`;
      if (ym !== selectedYm) return;

      const categoryName = row.category?.[0]?.name || "未分類";
      const key = categoryName;
      const amt = Number(row.amount || 0);

      if (!map.has(key)) {
        map.set(key, { category: categoryName, total: 0, papa: 0, mama: 0, shared: 0 });
      }
      const current = map.get(key)!;
      current.total += amt;
      if (row.user_tag === "papa") current.papa += amt;
      else if (row.user_tag === "mama") current.mama += amt;
      else current.shared += amt;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rawRows, selectedYm]);

  const handleAddComment = async () => {
    if (!householdId || !selectedYm || !newComment.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("コメントにはログインが必要です。");
      return;
    }
    const { data, error: insertError } = await supabase
      .from("comments")
      .insert({
        household_id: householdId,
        scope_type: "month",
        scope_key: selectedYm,
        content: newComment.trim(),
        created_by: user.id,
      })
      .select("id, content, created_at")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewComment("");
    setComments((prev) => [data as Comment, ...prev]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">集計グラフ & コメント</h1>
      {error && (
        <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">月別トレンド</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {loading ? (
            <p className="text-xs text-muted-foreground">集計中...</p>
          ) : monthlyData.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              表示できるデータがありません。
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <XAxis dataKey="ym" fontSize={11} />
                <YAxis fontSize={11} />
                <RechartsTooltip
                  formatter={(value: number | string) =>
                    `${Number(value).toLocaleString("ja-JP")}円`
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="合計"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">タグ別積み上げ（明細月別）</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {monthlyData.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              表示できるデータがありません。
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} stackOffset="none">
                <XAxis dataKey="ym" fontSize={11} />
                <YAxis fontSize={11} />
                <RechartsTooltip
                  formatter={(value: number | string) =>
                    `${Number(value).toLocaleString("ja-JP")}円`
                  }
                />
                <Legend />
                <Bar dataKey="papa" name="Papa" stackId="a" fill="#0f172a" />
                <Bar dataKey="mama" name="Mama" stackId="a" fill="#4b5563" />
                <Bar
                  dataKey="shared"
                  name="共通"
                  stackId="a"
                  fill="#9ca3af"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">費目別積み上げ（選択明細月）</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {!selectedYm || categoryData.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              表示できるデータがありません。
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} stackOffset="none">
                <XAxis dataKey="category" fontSize={11} />
                <YAxis fontSize={11} />
                <RechartsTooltip
                  formatter={(value: number | string) =>
                    `${Number(value).toLocaleString("ja-JP")}円`
                  }
                />
                <Legend />
                <Bar dataKey="papa" name="Papa" stackId="cat" fill="#0f172a" />
                <Bar dataKey="mama" name="Mama" stackId="cat" fill="#4b5563" />
                <Bar
                  dataKey="shared"
                  name="共通"
                  stackId="cat"
                  fill="#9ca3af"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">月別コメント</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              対象月を選択:
            </span>
            {monthlyData.map((m) => (
              <Button
                key={m.ym}
                size="sm"
                variant={m.ym === selectedYm ? "default" : "outline"}
                onClick={() => setSelectedYm(m.ym)}
              >
                {m.ym}
              </Button>
            ))}
          </div>

          {selectedMonthData && (
            <p className="text-xs text-muted-foreground">
              {selectedMonthData.ym} の合計支出:{" "}
              {selectedMonthData.total.toLocaleString("ja-JP")}円 （Papa:{" "}
              {selectedMonthData.papa.toLocaleString("ja-JP")}円 / Mama:{" "}
              {selectedMonthData.mama.toLocaleString("ja-JP")}円 / 共通:{" "}
              {selectedMonthData.shared.toLocaleString("ja-JP")}円）
            </p>
          )}

          <div className="space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="この月の振り返りやメモを残せます。"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddComment}
              disabled={!selectedYm || !newComment.trim()}
            >
              コメントを追加
            </Button>
          </div>

          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                まだコメントはありません。
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md border bg-card px-3 py-2 text-xs"
                >
                  <p className="whitespace-pre-wrap">{c.content}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


