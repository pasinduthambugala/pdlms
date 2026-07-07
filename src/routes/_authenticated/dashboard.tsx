import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ROLE_LABELS } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  FileText,
  Boxes,
  ClipboardCheck,
  Truck,
  AlertTriangle,
  UserPlus,
  DollarSign,
  Archive,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  pending_approval: "#f59e0b",
  approved: "#3b82f6",
  stored: "#10b981",
  pending_retrieval_approval: "#f97316",
  retrieval_approved: "#8b5cf6",
  retrieved: "#06b6d4",
  pending_return_approval: "#eab308",
  return_approved: "#14b8a6",
  disposed: "#64748b",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#14b8a6"];

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: any;
  tone?: "slate" | "amber" | "blue" | "emerald" | "violet" | "rose" | "cyan";
  to?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };
  const inner = (
    <Card className="p-5 hover:shadow-md transition-shadow h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
          {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
        </div>
        <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Dashboard() {
  const { data: user } = useCurrentUser();
  const isSuper = !!user?.roles.includes("super_admin");
  const isOfficeSvc = !!user?.roles.includes("office_services");
  const canSeeCosts = isSuper || isOfficeSvc;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-v2", user?.userId],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date();
      const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
      const days30Ago = new Date(today.getTime() - 30 * 86400000).toISOString();

      const [
        docs,
        carts,
        pendingApprovals,
        pendingRetrievals,
        disposalSoon,
        pendingActivations,
        disposed,
        cartsAll,
        docsRecent,
        recentCarts,
        depts,
        pos,
      ] = await Promise.all([
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
        supabase.from("carts").select("id", { count: "exact", head: true }).eq("status", "disposed"),
        supabase.from("carts").select("id,status,department_id,updated_at,created_at,disposal_date"),
        supabase.from("documents").select("id,created_at").gte("created_at", days30Ago),
        supabase.from("carts")
          .select("id,cart_number,status,updated_at,department_id,departments(name)")
          .order("updated_at", { ascending: false }).limit(6),
        supabase.from("departments").select("id,name"),
        canSeeCosts
          ? supabase.from("purchase_orders").select("id,type,amount,created_at")
          : Promise.resolve({ data: [] } as any),
      ]);

      return {
        docs: docs.count ?? 0,
        carts: carts.count ?? 0,
        pendingApprovals: pendingApprovals.count ?? 0,
        pendingRetrievals: pendingRetrievals.count ?? 0,
        disposalSoon: disposalSoon.count ?? 0,
        pendingActivations: pendingActivations.count ?? 0,
        disposed: disposed.count ?? 0,
        cartsAll: (cartsAll.data ?? []) as any[],
        docsRecent: (docsRecent.data ?? []) as any[],
        recentCarts: (recentCarts.data ?? []) as any[],
        depts: (depts.data ?? []) as any[],
        pos: ((pos as any).data ?? []) as any[],
      };
    },
  });

  if (!user) return null;

  // Derive chart data
  const statusCounts: Record<string, number> = {};
  (stats?.cartsAll ?? []).forEach((c: any) => {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([k, v]) => ({
    name: k.replace(/_/g, " "),
    value: v,
    fill: STATUS_COLORS[k] ?? "#64748b",
  }));

  const deptNameMap = new Map((stats?.depts ?? []).map((d: any) => [d.id, d.name]));
  const deptCounts: Record<string, number> = {};
  (stats?.cartsAll ?? []).forEach((c: any) => {
    const name = deptNameMap.get(c.department_id) ?? "Unassigned";
    deptCounts[name as string] = (deptCounts[name as string] ?? 0) + 1;
  });
  const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, carts: value }));

  // Docs registered per day (last 30d)
  const daySeries: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10);
    daySeries[d] = 0;
  }
  (stats?.docsRecent ?? []).forEach((d: any) => {
    const key = new Date(d.created_at).toISOString().slice(5, 10);
    if (key in daySeries) daySeries[key]++;
  });
  const trendData = Object.entries(daySeries).map(([date, count]) => ({ date, count }));

  // Disposal timeline (next 12 weeks)
  const weeks: { label: string; count: number }[] = [];
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const start = now + i * 7 * 86400000;
    const end = start + 7 * 86400000;
    const count = (stats?.cartsAll ?? []).filter((c: any) => {
      if (!c.disposal_date || c.status === "disposed") return false;
      const t = new Date(c.disposal_date).getTime();
      return t >= start && t < end;
    }).length;
    weeks.push({ label: `W${i + 1}`, count });
  }

  // Cost breakdown
  const costByType: Record<string, number> = { storage: 0, transport: 0, urgent_retrieval: 0 };
  (stats?.pos ?? []).forEach((p: any) => {
    costByType[p.type] = (costByType[p.type] ?? 0) + Number(p.amount || 0);
  });
  const costData = Object.entries(costByType).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));
  const totalCost = costData.reduce((s, x) => s + x.value, 0);

  const capacityUsed = (stats?.docs ?? 0);
  const capacityTotal = (stats?.carts ?? 0) * 60;
  const capacityPct = capacityTotal ? Math.round((capacityUsed / capacityTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, {user.profile.full_name ?? user.email} · {ROLE_LABELS[user.primaryRole]}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </Badge>
      </header>

      {!user.profile.is_active && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-sm text-amber-900">
            Your account is awaiting Super Admin activation. You can browse but cannot create or modify records yet.
          </div>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Stat label="Total Documents" value={stats?.docs ?? "—"} icon={FileText} tone="blue" to="/documents" />
        <Stat label="Total Carts" value={stats?.carts ?? "—"} icon={Boxes} tone="emerald" to="/carts" />
        <Stat label="Pending Approvals" value={stats?.pendingApprovals ?? "—"} icon={ClipboardCheck} tone="amber" to="/carts" />
        <Stat label="Retrieval Requests" value={stats?.pendingRetrievals ?? "—"} icon={Truck} tone="violet" to="/retrievals" />
        <Stat label="Disposal ≤14d" value={stats?.disposalSoon ?? "—"} icon={AlertTriangle} tone="rose" to="/disposal" />
        <Stat label="Disposed (all-time)" value={stats?.disposed ?? "—"} icon={Archive} tone="slate" />
        {canSeeCosts && (
          <Stat
            label="Total Spend"
            value={`$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            tone="cyan"
            to="/costs"
            hint={`${stats?.pos.length ?? 0} POs`}
          />
        )}
        {isSuper && (
          <Stat label="Pending Activations" value={stats?.pendingActivations ?? "—"} icon={UserPlus} tone="amber" to="/admin" />
        )}
      </div>







      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-medium text-slate-900 mb-4">Documents Registered — last 30 days</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium text-slate-900 mb-4">Carts by Status</div>
          <div className="h-64">
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-medium text-slate-900 mb-4">Carts by Department</div>
          <div className="h-64">
            {deptData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="carts" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium text-slate-900 mb-4">Disposal Forecast — next 12 weeks</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canSeeCosts && (
          <Card className="p-5">
            <div className="text-sm font-medium text-slate-900 mb-4">Cost Breakdown</div>
            <div className="h-64">
              {totalCost === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">No POs yet</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={costData} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => `$${Number(e.value).toFixed(0)}`}>
                      {costData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        )}

        <Card className={`p-5 ${canSeeCosts ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-slate-900">Recent Cart Activity</div>
            <Link to="/carts" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {(stats?.recentCarts ?? []).length === 0 && (
              <div className="text-sm text-slate-400 py-6 text-center">No recent activity</div>
            )}
            {(stats?.recentCarts ?? []).map((c: any) => (
              <Link
                key={c.id}
                to="/carts/$cartId"
                params={{ cartId: c.id }}
                className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{c.cart_number}</div>
                  <div className="text-xs text-slate-500">{c.departments?.name ?? "—"} · {new Date(c.updated_at).toLocaleString()}</div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

