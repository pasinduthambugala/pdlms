import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import type { CartStatus, RetrievalType } from "@/lib/types";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carts/$cartId")({
  component: CartDetail,
});

const EDITABLE_STATUSES: CartStatus[] = ["draft", "retrieved"];

function CartDetail() {
  const { cartId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const cartQ = useQuery({
    queryKey: ["cart", cartId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts").select("*, departments(name)").eq("id", cartId).single();
      if (error) throw error;
      return data;
    },
  });

  const docsQ = useQuery({
    queryKey: ["cart-docs", cartId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").eq("cart_id", cartId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const historyQ = useQuery({
    queryKey: ["cart-history", cartId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_approvals").select("*").eq("cart_id", cartId).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean)));
      let actors: Record<string, { full_name: string | null; email: string }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name, email").in("id", ids as string[]);
        actors = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return (data ?? []).map((r: any) => ({ ...r, actor: actors[r.actor_id] }));
    },
  });

  const transition = useMutation({
    mutationFn: async ({ status, action, extra }: { status: CartStatus; action: string; extra?: any }) => {
      if (!user) throw new Error("not signed in");
      const updates: any = { status, ...(extra ?? {}) };
      const { error: uErr } = await supabase.from("carts").update(updates).eq("id", cartId);
      if (uErr) throw uErr;
      await supabase.from("cart_approvals").insert({
        cart_id: cartId, action: action as any, actor_id: user.userId, comments: comment || null,
      });
      setComment("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart", cartId] });
      qc.invalidateQueries({ queryKey: ["cart-history", cartId] });
      qc.invalidateQueries({ queryKey: ["carts-with-counts"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cart = cartQ.data;
  if (!cart || !user) return null;

  const isDeptHead = user.roles.includes("dept_head") && cart.department_id === user.profile.department_id;
  const isAdmin = user.roles.includes("super_admin");
  const isOffice = user.roles.includes("office_services");
  const isOwnerDept = cart.department_id === user.profile.department_id;
  const canEditDocs = (isOwnerDept || isAdmin) && EDITABLE_STATUSES.includes(cart.status as CartStatus);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cart {cart.cart_number}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={cart.status as CartStatus} />
            <span className="text-sm text-slate-500">{cart.departments?.name}</span>
            <span className="text-sm text-slate-500">Disposal: {cart.disposal_date}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Documents ({docsQ.data?.length ?? 0}/60)</h2>
            <p className="text-xs text-slate-500 mb-3">Documents are registered from the Documents page and assigned to this cart there.</p>
            <div className="border-t border-slate-100 mt-2 pt-2">
              {docsQ.data?.length ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500"><th className="text-left py-2">Doc #</th><th className="text-left">Name</th><th className="text-left">Retention</th><th className="text-left">File</th><th></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {docsQ.data.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 font-mono text-xs">{d.document_number}</td>
                        <td>{d.document_name}</td>
                        <td className="text-slate-500">{d.retention_period != null ? `${d.retention_period} yrs` : "—"}</td>
                        <td className="text-slate-500">{d.file_number ?? "—"} {d.file_name ? `· ${d.file_name}` : ""}</td>
                        <td className="text-right">
                          {canEditDocs && (
                            <button
                              title="Unassign from this cart"
                              className="text-rose-600 hover:text-rose-800"
                              onClick={async () => {
                                await supabase.from("documents").update({ cart_id: null }).eq("id", d.id);
                                qc.invalidateQueries({ queryKey: ["cart-docs", cartId] });
                              }}><Trash2 className="w-4 h-4 inline" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-sm text-slate-400 py-4">No documents.</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-3">History</h2>
            <ul className="space-y-2 text-sm">
              {historyQ.data?.map((h: any) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="font-medium text-slate-800">{formatAction(h.action)}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(h.created_at).toLocaleString()} · by{" "}
                    <span className="font-medium text-slate-700">
                      {h.actor?.full_name ?? h.actor?.email ?? "Unknown user"}
                    </span>
                  </div>
                  {h.comments && <div className="text-slate-600 mt-1">"{h.comments}"</div>}
                </li>
              ))}
              {!historyQ.data?.length && <li className="text-slate-400">No history yet.</li>}
            </ul>
          </Card>
        </div>

        <div>
          <Card className="p-6 sticky top-6">
            <h2 className="font-semibold text-slate-900 mb-3">Actions</h2>
            <div>
              <Label htmlFor="cm" className="text-xs">Comment (optional)</Label>
              <Textarea id="cm" value={comment} onChange={(e) => setComment(e.target.value)} className="mb-3" rows={2} />
            </div>
            <div className="space-y-2">
              {cart.status === "draft" && (isOwnerDept || isAdmin) && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "pending_approval", action: "submit" })}>
                  Submit for approval
                </Button>
              )}
              {cart.status === "pending_approval" && (isDeptHead || isAdmin) && (
                <>
                  <Button className="w-full" onClick={() => transition.mutate({ status: "approved", action: "approve", extra: { approved_by: user.userId, approved_at: new Date().toISOString() } })}>Approve</Button>
                  <Button variant="destructive" className="w-full" onClick={() => transition.mutate({ status: "draft", action: "reject", extra: { rejection_reason: comment } })}>Reject (back to draft)</Button>
                </>
              )}
              {cart.status === "approved" && (isOwnerDept || isAdmin || isOffice) && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "stored", action: "mark_stored", extra: { stored_at: new Date().toISOString() } })}>
                  Mark as Stored
                </Button>
              )}
              {cart.status === "stored" && (isOwnerDept || isAdmin) && (
                <RetrievalRequest cartId={cartId} actorId={user.userId} comment={comment} onDone={() => { setComment(""); qc.invalidateQueries({ queryKey: ["cart", cartId] }); qc.invalidateQueries({ queryKey: ["cart-history", cartId] }); }} />
              )}
              {cart.status === "pending_retrieval_approval" && (isDeptHead || isAdmin) && (
                <>
                  <Button className="w-full" onClick={() => transition.mutate({ status: "retrieval_approved", action: "retrieval_approved" })}>Approve retrieval</Button>
                  <Button variant="destructive" className="w-full" onClick={() => transition.mutate({ status: "stored", action: "retrieval_rejected" })}>Reject</Button>
                </>
              )}
              {cart.status === "retrieval_approved" && (isOwnerDept || isAdmin || isOffice) && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "retrieved", action: "mark_retrieved", extra: { retrieved_at: new Date().toISOString() } })}>
                  Mark as Retrieved
                </Button>
              )}
              {cart.status === "retrieved" && (isOwnerDept || isAdmin) && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "pending_return_approval", action: "return_request" })}>
                  Submit return for approval
                </Button>
              )}
              {cart.status === "pending_return_approval" && (isDeptHead || isAdmin) && (
                <>
                  <Button className="w-full" onClick={() => transition.mutate({ status: "return_approved", action: "return_approved" })}>Approve return</Button>
                  <Button variant="destructive" className="w-full" onClick={() => transition.mutate({ status: "retrieved", action: "return_rejected" })}>Reject</Button>
                </>
              )}
              {cart.status === "return_approved" && (isOwnerDept || isAdmin || isOffice) && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "stored", action: "mark_stored", extra: { stored_at: new Date().toISOString() } })}>
                  Mark as Stored
                </Button>
              )}
              {(cart.status === "stored" || cart.status === "approved") && isAdmin && (
                <Button variant="outline" className="w-full" onClick={() => transition.mutate({ status: "disposed", action: "dispose" })}>
                  Mark as Disposed
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatAction(a: string) {
  const map: Record<string, string> = {
    create: "Cart created",
    submit: "Submitted for approval",
    approve: "Approved",
    reject: "Rejected",
    mark_stored: "Marked as Stored",
    mark_retrieved: "Marked as Retrieved",
    retrieval_request: "Retrieval requested",
    retrieval_approved: "Retrieval approved",
    retrieval_rejected: "Retrieval rejected",
    return_request: "Return requested",
    return_approved: "Return approved",
    return_rejected: "Return rejected",
    dispose: "Disposed",
  };
  return map[a] ?? a;
}

function RetrievalRequest({ cartId, actorId, comment, onDone }: { cartId: string; actorId: string; comment: string; onDone: () => void }) {
  const [type, setType] = useState<RetrievalType>("normal");
  return (
    <div className="space-y-2">
      <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as RetrievalType)}>
        <option value="normal">Normal retrieval</option>
        <option value="urgent">Urgent retrieval</option>
      </select>
      <Button className="w-full" onClick={async () => {
        const { error } = await supabase.from("carts").update({ status: "pending_retrieval_approval", retrieval_type: type }).eq("id", cartId);
        if (error) return toast.error(error.message);
        await supabase.from("cart_approvals").insert({ cart_id: cartId, action: "retrieval_request", actor_id: actorId, comments: comment || null });
        toast.success("Retrieval requested");
        onDone();
      }}>Request retrieval</Button>
    </div>
  );
}
