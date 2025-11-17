"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Role = "papa" | "mama";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("papa");
  const [householdName, setHouseholdName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      setError("ユーザー情報を取得できませんでした。メール認証を完了してください。");
      return;
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: displayName || null,
      role,
      default_tag: role,
    });

    if (profileError) {
      setLoading(false);
      setError(profileError.message);
      return;
    }

    // Household: join existing by name or create new
    const { data: existingHousehold, error: householdSelectError } =
      await supabase
        .from("households")
        .select("id")
        .eq("name", householdName)
        .maybeSingle();

    if (householdSelectError && householdSelectError.code !== "PGRST116") {
      setLoading(false);
      setError(householdSelectError.message);
      return;
    }

    let householdId = existingHousehold?.id as string | undefined;

    if (!householdId) {
      const { data: inserted, error: householdInsertError } = await supabase
        .from("households")
        .insert({ name: householdName })
        .select("id")
        .single();

      if (householdInsertError || !inserted) {
        setLoading(false);
        setError(householdInsertError?.message ?? "世帯の作成に失敗しました。");
        return;
      }

      householdId = inserted.id;
    }

    const { error: membershipError } = await supabase
      .from("users_households")
      .insert({
        user_id: user.id,
        household_id: householdId,
        role: "member",
      });

    setLoading(false);

    if (membershipError) {
      setError(membershipError.message);
      return;
    }

    router.push("/");
  };

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold">新規登録</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Papa / Mama のアカウントを作成し、同じ世帯名で参加すると家計を共同管理できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            メールアドレス
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            パスワード
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            表示名（任意）
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            自分のロール
          </label>
          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={role === "papa"}
                onCheckedChange={() => setRole("papa")}
              />
              <span>Papa</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={role === "mama"}
                onCheckedChange={() => setRole("mama")}
              />
              <span>Mama</span>
            </label>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            世帯名（例: Tanaka Family）
          </label>
          <input
            type="text"
            required
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Papa と Mama が同じ世帯名を入力すると同じ家計データを共有できます。
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登録中..." : "アカウントを作成"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        すでにアカウントをお持ちの場合は{" "}
        <button
          type="button"
          className="underline"
          onClick={() => router.push("/login")}
        >
          ログイン
        </button>
        してください。
      </p>
    </div>
  );
}


