import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, MessageSquare } from "lucide-react";
import type { CartStatus } from "@/lib/types";
import { CartViewDialog } from "./carts.index";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

type ApprovalSpec = {
  status: CartStatus;
  label: string;
  submitAction: string;
  approveTo: CartStatus;
  approveAction: string;
  rejectTo: CartStatus;
  rejectAction: string;
};

const CART_APPROVALS: ApprovalSpec[] = [
  { status: "pending_approval", label: "Storage approval", submitAction: "submit", approveTo: "approved", approveAction: "approve", rejectTo: "draft", rejectAction: "reject" },
  { status: "pending_return_approval", label: "Return approval", submitAction: "return_request", approveTo: "return_approved", approveAction: "return_approved", rejectTo: "retrieved", rejectAction: "return_rejected" },
];

const RETRIEVAL_APPROVALS: ApprovalSpec[] = [
  { status: "pending_retrieval_approval", label: "Retrieval approval", submitAction: "retrieval_request", approveTo: "retrieval_approved", approveAction: "retrieval_approved", rejectTo: "stored", rejectAction: "retrieval_rejected" },
];

function ApprovalsPage() {
  const { data: user } = useCurrentUser();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  if (!user) return null;
  const scopeAll = user.roles.includes("super_admin") || user.roles.includes("office_services");
  const allowed = scopeAll || user.roles.includes("dept_head");

  if (!allowed) {
    return (
      <Card className="p-6 text-sm text-slate-600">
        You don't have permission to view approvals.
      </Card>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500">
          {scopeAll ? "Review pending requests across all departments." : "Review pending requests for your department."}
        </p>
      </header>

      <Card className="p-5 mb-4">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
          <div className="text-sm font-semibold text-slate-900">Pending Approvals</div>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="pfrom" className="text-xs">From</Label>
              <Input id="pfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label htmlFor="pto" className="text-xs">To</Label>
              <Input id="pto" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="cart">
          <TabsList>
            <TabsTrigger value="cart">Cart Approval</TabsTrigger>
            <TabsTrigger value="retrieval">Retrieval Approval</TabsTrigger>
          </TabsList>
          <TabsContent value="cart">
            <PendingTable user={user} specs={CART_APPROVALS} scopeAll={scopeAll} from={from} to={to} kind="cart" />
          </TabsContent>
          <TabsContent value="retrieval">
            <PendingTable user={user} specs={RETRIEVAL_APPROVALS} scopeAll={scopeAll} from={from} to={to} kind="retrieval" />
          </TabsContent>
        </Tabs>
      </Card>

      <ApprovalHistory user={user} scopeAll={scopeAll} />
    </div>
  );
}

function PendingTable({
  user, specs, scopeAll, from, to, kind,
}: {
  user: any; specs: ApprovalSpec[]; scopeAll: boolean; from: string; to: string; kind: string;
}) {
  const qc = useQueryClient();
  const [viewId, setViewId] = useState<string | null>(null);
  const [commentView, setCommentView] = useState<{ cart: string; text: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const submitActions = specs.map((s) => s.submitAction);

  const q = useQuery({
    queryKey: ["approvals-pending", kind, user.userId, from, to, scopeAll],
    queryFn: async () => {
      let query = supabase
        .from("carts")
        .select("id,cart_number,status,created_at,updated_at,department_id,retrieval_type,departments(name),documents(id),cart_approvals(action,comments,created_at)")
        .in("status", specs.map((s) => s.status))
        .gte("updated_at", `${from}T00:00:00.000Z`)
        .lte("updated_at", `${to}T23:59:59.999Z`)
        .order("updated_at", { ascending: false });
      if (!scopeAll) query = query.eq("department_id", user.profile.department_id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((c: any) => {
        const req = (c.cart_approvals ?? [])
          .filter((a: any) => submitActions.includes(a.action))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return { ...c, requestComment: req?.comments ?? null, docCount: c.documents?.length ?? 0 };
      });
    },
  });

  const approve = useMutation({
    mutationFn: async (cart: any) => {
      const spec = specs.find((s) => s.status === cart.status)!;
      const extra: any = spec.status === "pending_approval"
        ? { approved_by: user.userId, approved_at: new Date().toISOString() }
        : {};
      const { error } = await supabase.from("carts").update({ status: spec.approveTo, ...extra }).eq("id", cart.id);
      if (error) throw error;
      await supabase.from("cart_approvals").insert({
        cart_id: cart.id, action: spec.approveAction as any, actor_id: user.userId, comments: null,
      });
    },
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["approvals-pending"] });
      qc.invalidateQueries({ queryKey: ["approvals-history"] });
      qc.invalidateQueries({ queryKey: ["carts-with-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ cart, reason }: { cart: any; reason: string }) => {
      const spec = specs.find((s) => s.status === cart.status)!;
      const { error } = await supabase.from("carts")
        .update({ status: spec.rejectTo, rejection_reason: reason })
        .eq("id", cart.id);
      if (error) throw error;
      await supabase.from("cart_approvals").insert({
        cart_id: cart.id, action: spec.rejectAction as any, actor_id: user.userId, comments: reason,
      });
    },
    onSuccess: () => {
      toast.success("Rejected");
      setRejectFor(null); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["approvals-pending"] });
      qc.invalidateQueries({ queryKey: ["approvals-history"] });
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
              <th className="text-left">Documents</th>
              <th className="text-left">Status</th>
              <th className="text-left">Requested</th>
              <th className="text-left">Comment</th>
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
                  <td className="text-slate-600">{c.docCount}</td>
                  <td><StatusBadge status={c.status as CartStatus} /></td>
                  <td className="text-slate-500 text-xs">{new Date(c.updated_at).toLocaleString()}</td>
                  <td>
                    {c.requestComment ? (
                      <Button size="sm" variant="outline" onClick={() => setCommentView({ cart: c.cart_number, text: c.requestComment })}>
                        <MessageSquare className="w-3 h-3 mr-1" /> View comment
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">No-Comments</span>
                    )}
                  </td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setViewId(c.id)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button size="sm" onClick={() => approve.mutate(c)} disabled={approve.isPending}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectFor(c); setRejectReason(""); }} disabled={reject.isPending}>Reject</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CartViewDialog cartId={viewId} onClose={() => setViewId(null)} />

      <Dialog open={!!commentView} onOpenChange={(o) => !o && setCommentView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comment — {commentView?.cart}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{commentView?.text}</p>
          <DialogFooter>
            <Button onClick={() => setCommentView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectFor?.cart_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rr">Reason for rejection</Label>
            <Textarea id="rr" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4}
              placeholder="Explain why this request is being rejected…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => reject.mutate({ cart: rejectFor, reason: rejectReason.trim() })}>
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const HISTORY_ACTIONS = [
  "approve", "reject",
  "retrieval_approved", "retrieval_rejected",
  "return_approved", "return_rejected",
];

function ApprovalHistory({ user, scopeAll }: { user: any; scopeAll: boolean }) {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["approvals-history", user.userId, from, to, scopeAll],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_approvals")
        .select("id,action,comments,created_at,actor_id,cart_id,carts(cart_number,department_id,rejection_reason,departments(name))")
        .in("action", HISTORY_ACTIONS as any)
        .gte("created_at", `${from}T00:00:00.000Z`)
        .lte("created_at", `${to}T23:59:59.999Z`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let rows = (data ?? []) as any[];
      if (!scopeAll) rows = rows.filter((r) => r.carts?.department_id === user.profile.department_id);

      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean)));
      let actors: Record<string, any> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
        actors = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return rows.map((r) => ({ ...r, actor: actors[r.actor_id] }));
    },
  });

  const isReject = (a: string) => a.includes("reject");

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Approval History</div>
          <div className="text-xs text-slate-500">
            {scopeAll ? "All departments" : "Your department only"}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="hfrom" className="text-xs">From</Label>
            <Input id="hfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label htmlFor="hto" className="text-xs">To</Label>
            <Input id="hto" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">No approval activity in this range.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b">
                <th className="text-left py-2">Cart</th>
                <th className="text-left">Department</th>
                <th className="text-left">Action</th>
                <th className="text-left">By</th>
                <th className="text-left">When</th>
                <th className="text-left">Reason / Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data!.map((r: any) => (
                <tr key={r.id}>
                  <td className="py-2 font-medium text-slate-900">{r.carts?.cart_number ?? "—"}</td>
                  <td className="text-slate-600">{r.carts?.departments?.name ?? "—"}</td>
                  <td className="text-slate-600">{formatAction(r.action)}</td>
                  <td className="text-slate-600">{r.actor?.full_name ?? r.actor?.email ?? "—"}</td>
                  <td className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className={isReject(r.action) ? "text-rose-600" : "text-slate-600"}>
                    {r.comments ?? (isReject(r.action) ? r.carts?.rejection_reason ?? "—" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function formatAction(a: string) {
  const map: Record<string, string> = {
    approve: "Storage approved",
    reject: "Storage rejected",
    retrieval_approved: "Retrieval approved",
    retrieval_rejected: "Retrieval rejected",
    return_approved: "Return approved",
    return_rejected: "Return rejected",
  };
  return map[a] ?? a;
}
