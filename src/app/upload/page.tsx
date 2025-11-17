"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ParsedRow = {
  date: string;
  merchant: string;
  amount: number;
  categoryRaw: string;
};

async function getCurrentUserAndHousehold() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, householdId: null };

  const SHARED_HOUSEHOLD_ID = "11111111-1111-1111-1111-111111111111";

  const { data: membership } = await supabase
    .from("users_households")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.household_id) {
    return { user, householdId: membership.household_id as string };
  }

  // Fallback: 世帯情報がなければ共有世帯を自動作成する
  const { error: membershipError } = await supabase
    .from("users_households")
    .insert({
      user_id: user.id,
      household_id: SHARED_HOUSEHOLD_ID,
      role: "member",
    });

  if (membershipError) {
    console.error("Failed to create users_households", membershipError);
    return { user, householdId: null };
  }

  return { user, householdId: SHARED_HOUSEHOLD_ID };
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const headerIndex = lines.findIndex((line) =>
    line.includes("ご利用先など")
  );
  if (headerIndex === -1) return [];

  const dataLines = lines.slice(headerIndex + 1);
  const rows: ParsedRow[] = [];

  for (const line of dataLines) {
    if (!line.startsWith('"')) continue;
    try {
      const jsonLine = `[${line}]`;
      const cols: string[] = JSON.parse(jsonLine);
      if (cols.length < 5) continue;

      const dateStr = cols[2]?.trim().replace(/^"/, "");
      const merchant = cols[3]?.trim();
      const amountStr = (cols[4] || cols[8] || "0").replace(/,/g, "");
      const amount = Number(amountStr);
      if (!dateStr || !merchant || !amount || Number.isNaN(amount)) continue;

      const isoDate = new Date(dateStr).toISOString().slice(0, 10);

      rows.push({
        date: isoDate,
        merchant,
        amount,
        categoryRaw: cols[1] ?? "",
      });
    } catch {
      continue;
    }
  }

  return rows;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [source, setSource] = useState("JCB");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [householdReady, setHouseholdReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { user, householdId } = await getCurrentUserAndHousehold();
      if (!user) {
        setError("アップロードにはログインが必要です。");
        return;
      }
      if (!householdId) {
        setError("世帯情報が見つかりませんでした。サインアップ設定を確認してください。");
        return;
      }
      setHouseholdReady(true);
    })();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setParsedRows([]);
    setMessage(null);
    setError(null);

    if (!f) return;

    const match = f.name.match(/(20\d{2})(\d{2})/);
    if (match) {
      setYear(Number(match[1]));
      setMonth(Number(match[2]));
    }

    const text = await f.text();
    const rows = parseCsv(text);
    setParsedRows(rows);
    setMessage(`${rows.length} 件の明細を検出しました。`);
  };

  const handleUpload = async () => {
    setError(null);
    setMessage(null);
    if (!file || !year || !month) {
      setError("ファイルと年月を確認してください。");
      return;
    }
    if (!parsedRows.length) {
      setError("有効な明細行が見つかりませんでした。");
      return;
    }

    setLoading(true);

    const { user, householdId } = await getCurrentUserAndHousehold();
    if (!user || !householdId) {
      setLoading(false);
      setError("認証または世帯情報の取得に失敗しました。");
      return;
    }

    const { data: existing } = await supabase
      .from("statements")
      .select("id")
      .eq("household_id", householdId)
      .eq("year", year)
      .eq("month", month)
      .eq("source", source)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("statements").delete().eq("id", existing.id);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("statements")
      .insert({
        household_id: householdId,
        year,
        month,
        source,
        original_filename: file.name,
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setLoading(false);
      setError(insertError?.message ?? "明細メタ情報の登録に失敗しました。");
      return;
    }

    const statementId = inserted.id as string;

    const batches: ParsedRow[][] = [];
    const batchSize = 500;
    for (let i = 0; i < parsedRows.length; i += batchSize) {
      batches.push(parsedRows.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const payload = batch.map((row) => ({
        statement_id: statementId,
        household_id: householdId,
        posting_date: row.date,
        amount: row.amount,
        description: row.merchant,
        raw_merchant: row.merchant,
        user_tag: "shared",
      }));

      const { error: txError } = await supabase
        .from("transactions")
        .insert(payload);

      if (txError) {
        setLoading(false);
        setError(`明細行の登録に失敗しました: ${txError.message}`);
        return;
      }
    }

    setLoading(false);
    setMessage("アップロードが完了しました。明細一覧で内容を確認できます。");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">明細ファイルのアップロード</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            クレジットカード明細（CSV）をアップロード
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={!householdReady}
            />
            <p className="text-xs text-muted-foreground">
              例: JCB オンライン明細の CSV ファイル（2025xxmeisai.csv）
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                年
              </label>
              <input
                type="number"
                value={year ?? ""}
                onChange={(e) =>
                  setYear(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                月
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={month ?? ""}
                onChange={(e) =>
                  setMonth(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                カード種別（任意）
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {parsedRows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              プレビュー: {parsedRows.length} 件 / 合計{" "}
              {parsedRows
                .reduce((sum, r) => sum + r.amount, 0)
                .toLocaleString("ja-JP")}
              円
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>
          )}
          {message && (
            <p className="text-xs text-emerald-600 whitespace-pre-wrap">
              {message}
            </p>
          )}

          <Button
            type="button"
            onClick={handleUpload}
            disabled={loading || !householdReady}
          >
            {loading ? "アップロード中..." : "この内容でアップロード"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


