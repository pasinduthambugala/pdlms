import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import type { POType } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/costs")({
  component: Costs,
});

function Costs() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const isOffice = user?.roles.includes("super_admin") || user?.roles.includes("office_services");

  const posQ = useQuery({
    queryKey: ["pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, departments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const allocQ = useQuery({
    queryKey: ["allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_allocations")
        .select("*, departments(name), purchase_orders(po_number, po_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cost Management</h1>
        <p className="text-sm text-slate-500">Purchase orders and department cost allocations.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isOffice && (
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="font-semibold mb-3">New Purchase Order</h2>
              <NewPOForm onCreated={() => { qc.invalidateQueries({ queryKey: ["pos"] }); qc.invalidateQueries({ queryKey: ["allocations"] }); }} userId={user!.userId} />
            </Card>
          </div>
        )}

        <div className={isOffice ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Purchase Orders</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">PO #</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Department</th>
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-left px-4 py-2">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posQ.data?.length ? posQ.data.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.po_number}</td>
                    <td className="px-4 py-2">{p.po_type}</td>
                    <td className="px-4 py-2">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-2">{p.departments?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{p.period_start ?? "—"} → {p.period_end ?? "—"}</td>
                    <td className="px-4 py-2">
                      {p.attachment_url ? (
                        <button className="text-blue-600 hover:underline text-xs"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("po-attachments")
                              .createSignedUrl(p.attachment_url, 60);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}>
                          {p.attachment_name ?? "Download"}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No purchase orders.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Cost Allocations</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">PO #</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Department</th>
                  <th className="text-left px-4 py-2">Carts</th>
                  <th className="text-left px-4 py-2">Allocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocQ.data?.length ? allocQ.data.map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium">{a.purchase_orders?.po_number}</td>
                    <td className="px-4 py-2">{a.purchase_orders?.po_type}</td>
                    <td className="px-4 py-2">{a.departments?.name}</td>
                    <td className="px-4 py-2">{a.cart_count ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">${Number(a.amount).toFixed(2)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No allocations yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NewPOForm({ onCreated, userId }: { onCreated: () => void; userId: string }) {
  const [poNumber, setPoNumber] = useState("");
  const [type, setType] = useState<POType>("storage");
  const [amount, setAmount] = useState(0);
  const [deptId, setDeptId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      if (file) {
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("po-attachments").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        attachment_url = path;
        attachment_name = file.name;
      }
      // Insert PO
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        po_number: poNumber, po_type: type, amount,
        department_id: type === "transport" ? null : (deptId || null),
        period_start: periodStart || null, period_end: periodEnd || null,
        description: description || null, created_by: userId,
        attachment_url, attachment_name,
      }).select().single();
      if (error) throw error;

      // Auto-allocate
      if (type === "storage" && po.department_id) {
        await supabase.from("cost_allocations").insert({
          purchase_order_id: po.id, department_id: po.department_id, amount,
          notes: "Storage cost (owning department)",
        });
      } else if (type === "urgent_retrieval" && po.department_id) {
        await supabase.from("cost_allocations").insert({
          purchase_order_id: po.id, department_id: po.department_id, amount,
          notes: "Urgent retrieval (requesting department)",
        });
      } else if (type === "transport") {
        // Pro-rate by stored carts per department within period (fallback: all-time)
        const cartsQ = supabase.from("carts").select("department_id");
        if (periodStart) cartsQ.gte("created_at", periodStart);
        if (periodEnd) cartsQ.lte("created_at", periodEnd);
        const { data: carts } = await cartsQ;
        const counts = new Map<string, number>();
        (carts ?? []).forEach((c: any) => counts.set(c.department_id, (counts.get(c.department_id) ?? 0) + 1));
        const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
        const rows = Array.from(counts.entries()).map(([d, n]) => ({
          purchase_order_id: po.id,
          department_id: d,
          cart_count: n,
          amount: Number(((n / total) * amount).toFixed(2)),
          notes: `Pro-rated transport (${n}/${total})`,
        }));
        if (rows.length) await supabase.from("cost_allocations").insert(rows);
      }

      toast.success("Purchase order created and allocated");
      setPoNumber(""); setAmount(0); setDeptId(""); setDescription("");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div><Label>PO Number</Label><Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required /></div>
      <div>
        <Label>Type</Label>
        <select className="w-full border border-slate-200 rounded-md px-3 py-2" value={type} onChange={(e) => setType(e.target.value as POType)}>
          <option value="storage">Storage</option>
          <option value="transport">Transport (pro-rated)</option>
          <option value="urgent_retrieval">Urgent Retrieval</option>
        </select>
      </div>
      <div><Label>Amount</Label><Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} required /></div>
      {type !== "transport" && (
        <div>
          <Label>Department</Label>
          <select className="w-full border border-slate-200 rounded-md px-3 py-2" value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
            <option value="">Select…</option>
            {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Period start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
        <div><Label>Period end</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
      </div>
      <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <Button type="submit" className="w-full">Create PO + allocate</Button>
    </form>
  );
}
