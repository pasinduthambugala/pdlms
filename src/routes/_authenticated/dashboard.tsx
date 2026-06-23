import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </Card>
  );
}

function Dashboard() {
  const { data: user } = useCurrentUser();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.userId],
    enabled: !!user,
    queryFn: async () => {
      const isSuper = user!.roles.includes("super_admin");
      const today = new Date();
      const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);

      // RLS already filters by department for non-super roles.
      const [docs, carts, pendingApprovals, pendingRetrievals, disposalSoon, pendingActivations] =
        await Promise.all([
          supabase.from("documents").select("id", { count: "exact", head: true }),
          supabase.from("carts").select("id", { count: "exact", head: true }),
          supabase.from("carts").select("id", { count: "exact", head: true })
            .in("status", ["pending_approval", "pending_return_approval"]),
          supabase.from("carts").select("id", { count: "exact", head: true })
            .eq("status", "pending_retrieval_approval"),
          supabase.from("carts").select("id", { count: "exact", head: true })
            .lte("disposal_date", in14).neq("status", "disposed"),
          isSuper
            ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false)
            : Promise.resolve({ count: 0 } as any),
        ]);

      return {
        docs: docs.count ?? 0,
        carts: carts.count ?? 0,
        pendingApprovals: pendingApprovals.count ?? 0,
        pendingRetrievals: pendingRetrievals.count ?? 0,
        disposalSoon: disposalSoon.count ?? 0,
        pendingActivations: pendingActivations.count ?? 0,
      };
    },
  });

  if (!user) return null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Welcome back, {user.profile.full_name ?? user.email} · {ROLE_LABELS[user.primaryRole]}
        </p>
      </header>

      {!user.profile.is_active && (
        <Card className="p-4 mb-6 bg-amber-50 border-amber-200">
          <div className="text-sm text-amber-900">
            Your account is awaiting Super Admin activation. You can browse but cannot create or modify records yet.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Stat label="Total Documents" value={stats?.docs ?? "—"} />
        <Stat label="Total Carts" value={stats?.carts ?? "—"} />
        <Stat label="Pending Approvals" value={stats?.pendingApprovals ?? "—"} />
        <Stat label="Retrieval Requests" value={stats?.pendingRetrievals ?? "—"} />
        <Stat label="Disposal Alerts (≤14d)" value={stats?.disposalSoon ?? "—"} />
        {user.roles.includes("super_admin") && (
          <Stat label="Pending Activations" value={stats?.pendingActivations ?? "—"} />
        )}
      </div>
    </div>
  );
}
