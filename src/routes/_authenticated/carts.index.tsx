import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus, Search, Eye, CalendarIcon } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { STATUS_LABELS, type CartStatus } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/carts/")({
  component: CartsList,
});

const FILTER_STATUSES: CartStatus[] = [
  "draft", "pending_approval", "approved", "stored",
  "pending_retrieval_approval", "retrieval_approved",
  "retrieved", "pending_return_approval", "return_approved", "disposed",
];

function CartsList() {
  const { data: user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [viewId, setViewId] = useState<string | null>(null);

  const canCreateCart =
    !!user && (user.roles.includes("super_admin") ||
      user.roles.includes("employee") ||
      user.roles.includes("office_services")) &&
    !user.roles.includes("dept_head");

  const { data: carts } = useQuery({
    queryKey: ["carts-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name), documents(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!carts) return [];
    const q = search.trim().toLowerCase();
    return carts.filter((c: any) => {
      if (status !== "all" && c.status !== status) return false;
      if (q && !c.cart_number.toLowerCase().includes(q)) return false;
      const updated = new Date(c.updated_at ?? c.created_at);
      if (from && updated < from) return false;
      if (to && updated > new Date(to.getTime() + 86400000)) return false;
      return true;
    });
  }, [carts, search, status, from, to]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cart Management</h1>
          <p className="text-sm text-slate-500">Document carts and their lifecycle status.</p>
        </div>
        {canCreateCart && (
          <Link to="/carts/new">
            <Button disabled={!user?.profile.is_active}>
              <Plus className="w-4 h-4 mr-2" /> New cart
            </Button>
          </Link>
        )}
      </header>

      {user && (user.roles.includes("dept_head") || user.roles.includes("super_admin") || user.roles.includes("office_services")) && (
        <ApprovalsPanel user={user} />
      )}


      <Card className="p-4 mb-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cart number…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          {(from || to) && (
            <Button size="sm" variant="ghost" onClick={() => { setFrom(undefined); setTo(undefined); }}>
              Clear
            </Button>
          )}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {FILTER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart Number</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Documents</th>
              <th className="text-left px-4 py-3">Capacity</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Last Updated</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((c: any) => {
              const count = c.documents?.length ?? 0;
              const pct = Math.round((count / 60) * 100);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.cart_number}</td>
                  <td className="px-4 py-3 text-slate-600">{c.departments?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{count}/60</td>
                  <td className="px-4 py-3 text-slate-600">{pct}%</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.updated_at ?? c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setViewId(c.id)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No carts found.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <CartViewDialog cartId={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
          className={cn("justify-start text-left font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="w-3 h-3 mr-2" />
          {value ? format(value, "PP") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function CartViewDialog({ cartId, onClose }: { cartId: string | null; onClose: () => void }) {
  const { data: cart } = useQuery({
    queryKey: ["cart-view", cartId],
    enabled: !!cartId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name), documents(id, document_number, document_name, retention_period, file_number, file_name, registration_date, created_at)")
        .eq("id", cartId!)
        .single();
      if (error) throw error;
      return data;

    },
  });

  const docs = (cart?.documents ?? []) as any[];
  const count = docs.length;
  const pct = Math.round((count / 60) * 100);

  return (
    <Dialog open={!!cartId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cart — {cart?.cart_number ?? "…"}</DialogTitle>
        </DialogHeader>

        {cart && (
          <>
            <div className="grid grid-cols-4 gap-4 py-2 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-500">Cart Number</div>
                <div className="font-medium font-mono">{cart.cart_number}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Department</div>
                <div className="font-medium">{cart.departments?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Status</div>
                <div><StatusBadge status={cart.status} /></div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Capacity</div>
                <div className="font-medium">{count}/60 ({pct}%)</div>
                <Progress value={pct} className="h-1.5 mt-1" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-slate-900 mb-2">Documents in this cart ({count})</h3>
              <div className="border border-slate-100 rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Document Name</th>
                      <th className="text-left px-3 py-2">Document Number</th>
                      <th className="text-left px-3 py-2">Retention Period</th>
                      <th className="text-left px-3 py-2">File Number</th>
                      <th className="text-left px-3 py-2">File Name</th>
                      <th className="text-left px-3 py-2">Registered Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docs.length ? docs.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2">{d.document_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{d.document_number}</td>
                        <td className="px-3 py-2">{d.retention_period} days</td>
                        <td className="px-3 py-2">{d.file_number ?? "—"}</td>
                        <td className="px-3 py-2">{d.file_name ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {d.registration_date
                            ? new Date(d.registration_date).toLocaleDateString()
                            : d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No documents.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            <DialogFooter className="mt-4">
              <Link to="/carts/$cartId" params={{ cartId: cart.id }}>
                <Button variant="outline">Open full detail</Button>
              </Link>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ApprovalSpec = {
  status: CartStatus;
  label: string;
  approveTo: CartStatus;
  approveAction: string;
  rejectTo: CartStatus;
  rejectAction: string;
};

const CART_APPROVALS: ApprovalSpec[] = [
  { status: "pending_approval", label: "Storage approval", approveTo: "approved", approveAction: "approve", rejectTo: "draft", rejectAction: "reject" },
  { status: "pending_return_approval", label: "Return approval", approveTo: "return_approved", approveAction: "return_approved", rejectTo: "retrieved", rejectAction: "return_rejected" },
];

const RETRIEVAL_APPROVALS: ApprovalSpec[] = [
  { status: "pending_retrieval_approval", label: "Retrieval approval", approveTo: "retrieval_approved", approveAction: "retrieval_approved", rejectTo: "stored", rejectAction: "retrieval_rejected" },
];

function ApprovalsPanel({ user }: { user: any }) {
  const scopeAll = user.roles.includes("super_admin") || user.roles.includes("office_services");
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Pending Approvals</div>
          <div className="text-xs text-slate-500">
            {scopeAll ? "All departments" : "Your department only"}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="apfrom" className="text-xs">From</Label>
            <Input id="apfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label htmlFor="apto" className="text-xs">To</Label>
            <Input id="apto" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="cart">
        <TabsList>
          <TabsTrigger value="cart">Cart Approval</TabsTrigger>
          <TabsTrigger value="retrieval">Retrieval Approval</TabsTrigger>
        </TabsList>
        <TabsContent value="cart">
          <ApprovalsTable user={user} specs={CART_APPROVALS} scopeAll={scopeAll} from={from} to={to} kind="cart" />
        </TabsContent>
        <TabsContent value="retrieval">
          <ApprovalsTable user={user} specs={RETRIEVAL_APPROVALS} scopeAll={scopeAll} from={from} to={to} kind="retrieval" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ApprovalsTable({
  user, specs, scopeAll, from, to, kind,
}: {
  user: any; specs: ApprovalSpec[]; scopeAll: boolean; from: string; to: string; kind: string;
}) {
  const qc = useQueryClient();
  const [viewId, setViewId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["cart-approvals", kind, user.userId, from, to, scopeAll],
    queryFn: async () => {
      let query = supabase
        .from("carts")
        .select("id,cart_number,status,created_at,updated_at,department_id,retrieval_type,departments(name)")
        .in("status", specs.map((s) => s.status))
        .gte("updated_at", `${from}T00:00:00.000Z`)
        .lte("updated_at", `${to}T23:59:59.999Z`)
        .order("updated_at", { ascending: false });
      if (!scopeAll) query = query.eq("department_id", user.profile.department_id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: async ({ cart, approve }: { cart: any; approve: boolean }) => {
      const spec = specs.find((s) => s.status === cart.status)!;
      const status = approve ? spec.approveTo : spec.rejectTo;
      const action = approve ? spec.approveAction : spec.rejectAction;
      const extra: any = approve && spec.status === "pending_approval"
        ? { approved_by: user.userId, approved_at: new Date().toISOString() }
        : {};
      const { error } = await supabase.from("carts").update({ status, ...extra }).eq("id", cart.id);
      if (error) throw error;
      await supabase.from("cart_approvals").insert({
        cart_id: cart.id, action: action as any, actor_id: user.userId, comments: null,
      });
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["cart-approvals"] });
      qc.invalidateQueries({ queryKey: ["carts-with-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>;
  if ((q.data ?? []).length === 0)
    return <div className="text-sm text-slate-400 py-6 text-center">No pending approvals in this date range.</div>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b">
              <th className="text-left py-2">Cart</th>
              <th className="text-left">Department</th>
              <th className="text-left">Type</th>
              <th className="text-left">Status</th>
              <th className="text-left">Requested</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {q.data!.map((c: any) => {
              const spec = specs.find((s) => s.status === c.status)!;
              return (
                <tr key={c.id}>
                  <td className="py-2 font-medium text-slate-900">{c.cart_number}</td>
                  <td className="text-slate-600">{c.departments?.name ?? "—"}</td>
                  <td className="text-slate-600">{spec.label}{c.retrieval_type ? ` (${c.retrieval_type})` : ""}</td>
                  <td><StatusBadge status={c.status as CartStatus} /></td>
                  <td className="text-slate-500 text-xs">{new Date(c.updated_at).toLocaleString()}</td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setViewId(c.id)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button size="sm" onClick={() => act.mutate({ cart: c, approve: true })} disabled={act.isPending}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => act.mutate({ cart: c, approve: false })} disabled={act.isPending}>Reject</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CartViewDialog cartId={viewId} onClose={() => setViewId(null)} />
    </>
  );
}

