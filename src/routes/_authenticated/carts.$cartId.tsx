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
      return data;
    },
  });

  const transition = useMutation({
    mutationFn: async ({ status, action, extra }: { status: CartStatus; action: any; extra?: any }) => {
      if (!user) throw new Error("not signed in");
      const updates: any = { status, ...(extra ?? {}) };
      const { error: uErr } = await supabase.from("carts").update(updates).eq("id", cartId);
      if (uErr) throw uErr;
      await supabase.from("cart_approvals").insert({
        cart_id: cartId, action, actor_id: user.userId, comments: comment || null,
      });
      setComment("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart", cartId] });
      qc.invalidateQueries({ queryKey: ["cart-history", cartId] });
      qc.invalidateQueries({ queryKey: ["carts"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cart = cartQ.data;
  if (!cart || !user) return null;

  const isDeptHead = user.roles.includes("dept_head") && cart.department_id === user.profile.department_id;
  const isAdmin = user.roles.includes("super_admin");
  const isOwnerDept = cart.department_id === user.profile.department_id;
  const canEditDocs = isOwnerDept && EDITABLE_STATUSES.includes(cart.status);
  const isAtCapacity = (docsQ.data?.length ?? 0) >= 60;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cart {cart.cart_number}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={cart.status} />
            <span className="text-sm text-slate-500">{cart.departments?.name}</span>
            <span className="text-sm text-slate-500">Disposal: {cart.disposal_date}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Documents ({docsQ.data?.length ?? 0}/60)</h2>
            {canEditDocs && !isAtCapacity && <NewDocForm cartId={cartId} departmentId={cart.department_id} userId={user.userId} onAdded={() => qc.invalidateQueries({ queryKey: ["cart-docs", cartId] })} />}
            {isAtCapacity && <p className="text-xs text-amber-700 mb-3">Cart is at full capacity (60 documents).</p>}
            <div className="border-t border-slate-100 mt-4 pt-2">
              {docsQ.data?.length ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500"><th className="text-left py-2">Doc #</th><th className="text-left">Name</th><th className="text-left">File</th><th></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {docsQ.data.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 font-mono text-xs">{d.document_number}</td>
                        <td>{d.document_name}</td>
                        <td className="text-slate-500">{d.file_number ?? "—"} {d.file_name ? `· ${d.file_name}` : ""}</td>
                        <td className="text-right">
                          {canEditDocs && (
                            <button
                              className="text-rose-600 hover:text-rose-800"
                              onClick={async () => {
                                await supabase.from("documents").delete().eq("id", d.id);
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
                  <div className="font-medium text-slate-800">{h.action}</div>
                  <div className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</div>
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
              {cart.status === "draft" && isOwnerDept && (
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
              {cart.status === "approved" && isOwnerDept && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "stored", action: "mark_stored", extra: { stored_at: new Date().toISOString() } })}>
                  Mark as Stored
                </Button>
              )}
              {cart.status === "stored" && isOwnerDept && (
                <RetrievalRequest cartId={cartId} actorId={user.userId} comment={comment} onDone={() => { setComment(""); qc.invalidateQueries({ queryKey: ["cart", cartId] }); qc.invalidateQueries({ queryKey: ["cart-history", cartId] }); }} />
              )}
              {cart.status === "pending_retrieval_approval" && (isDeptHead || isAdmin) && (
                <>
                  <Button className="w-full" onClick={() => transition.mutate({ status: "retrieved", action: "retrieval_approved", extra: { retrieved_at: new Date().toISOString() } })}>Approve retrieval</Button>
                  <Button variant="destructive" className="w-full" onClick={() => transition.mutate({ status: "stored", action: "retrieval_rejected" })}>Reject</Button>
                </>
              )}
              {cart.status === "retrieved" && isOwnerDept && (
                <Button className="w-full" onClick={() => transition.mutate({ status: "pending_return_approval", action: "return_request" })}>
                  Submit return for approval
                </Button>
              )}
              {cart.status === "pending_return_approval" && (isDeptHead || isAdmin) && (
                <>
                  <Button className="w-full" onClick={() => transition.mutate({ status: "stored", action: "return_approved", extra: { stored_at: new Date().toISOString() } })}>Approve return</Button>
                  <Button variant="destructive" className="w-full" onClick={() => transition.mutate({ status: "retrieved", action: "return_rejected" })}>Reject</Button>
                </>
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

function NewDocForm({ cartId, departmentId, userId, onAdded }: { cartId: string; departmentId: string; userId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [retention, setRetention] = useState(365);
  const [fileNum, setFileNum] = useState("");
  const [fileName, setFileName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("documents").insert({
      cart_id: cartId,
      document_name: name,
      document_number: num,
      retention_period: retention,
      file_number: fileNum || null,
      file_name: fileName || null,
      department_id: departmentId,
      created_by: userId,
    });
    if (error) return toast.error(error.message);
    setName(""); setNum(""); setFileNum(""); setFileName("");
    toast.success("Document added");
    onAdded();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 mb-3">
      <Input placeholder="Document name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input placeholder="Document number (unique)" value={num} onChange={(e) => setNum(e.target.value)} required />
      <Input type="number" min={1} placeholder="Retention days" value={retention} onChange={(e) => setRetention(parseInt(e.target.value))} required />
      <Input placeholder="File number (optional)" value={fileNum} onChange={(e) => setFileNum(e.target.value)} />
      <Input placeholder="File name (optional)" value={fileName} onChange={(e) => setFileName(e.target.value)} className="col-span-2" />
      <Button type="submit" className="col-span-2">Add document</Button>
    </form>
  );
}
