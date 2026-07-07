import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  const deptFilter = !isOffice ? user?.profile.department_id ?? null : null;

  const posQ = useQuery({
    queryKey: ["pos", deptFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("purchase_orders")
        .select("*, departments(name)")
        .order("created_at", { ascending: false });
      if (deptFilter) q = q.eq("department_id", deptFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const allocQ = useQuery({
    queryKey: ["allocations", deptFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("cost_allocations")
        .select("*, departments(name), purchase_orders(po_number, po_type)")
        .order("created_at", { ascending: false });
      if (deptFilter) q = q.eq("department_id", deptFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const inventoryQ = useQuery({
    queryKey: ["dept-inventory", deptFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("department_inventory" as any)
        .select("*")
        .order("department_name");
      if (deptFilter) q = q.eq("department_id", deptFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const reportQ = useQuery({
    queryKey: ["dept-cost-report", deptFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("department_cost_report" as any)
        .select("*")
        .order("department_name");
      if (deptFilter) q = q.eq("department_id", deptFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cost Management</h1>
        <p className="text-sm text-slate-500">Purchase orders, allocations & department cost reporting.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isOffice && (
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="font-semibold mb-3">New Purchase Order</h2>
              <NewPOForm
                inventory={inventoryQ.data ?? []}
                onCreated={() => {
                  qc.invalidateQueries({ queryKey: ["pos"] });
                  qc.invalidateQueries({ queryKey: ["allocations"] });
                  qc.invalidateQueries({ queryKey: ["dept-cost-report"] });
                }}
                userId={user!.userId}
              />
            </Card>
          </div>
        )}

        <div className={isOffice ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Department Inventory</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">Department</th>
                  <th className="text-left px-4 py-2">Boxes Stored</th>
                  <th className="text-left px-4 py-2">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryQ.data?.length ? inventoryQ.data.map((r: any) => (
                  <tr key={r.department_id}>
                    <td className="px-4 py-2 font-medium">{r.department_name}</td>
                    <td className="px-4 py-2">{r.total_boxes}</td>
                    <td className="px-4 py-2 text-slate-500">{r.last_updated ? new Date(r.last_updated).toLocaleDateString() : "—"}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No inventory.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Department Cost Report</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">Department</th>
                  <th className="text-left px-4 py-2">Storage</th>
                  <th className="text-left px-4 py-2">Transport</th>
                  <th className="text-left px-4 py-2">Urgent</th>
                  <th className="text-left px-4 py-2">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportQ.data?.length ? reportQ.data.map((r: any) => (
                  <tr key={r.department_id}>
                    <td className="px-4 py-2 font-medium">{r.department_name}</td>
                    <td className="px-4 py-2">${Number(r.storage_cost).toFixed(2)}</td>
                    <td className="px-4 py-2">${Number(r.transport_cost).toFixed(2)}</td>
                    <td className="px-4 py-2">${Number(r.urgent_cost).toFixed(2)}</td>
                    <td className="px-4 py-2 font-semibold">${Number(r.grand_total).toFixed(2)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No cost data.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Purchase Orders</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">PO #</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Boxes</th>
                  <th className="text-left px-4 py-2">Unit Price</th>
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
                    <td className="px-4 py-2">{p.box_count ?? "—"}</td>
                    <td className="px-4 py-2">{p.unit_price ? `$${Number(p.unit_price).toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2 font-medium">${Number(p.amount).toFixed(2)}</td>
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
                )) : <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No purchase orders.</td></tr>}
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

function NewPOForm({
  onCreated, userId, inventory,
}: { onCreated: () => void; userId: string; inventory: any[] }) {
  const [poNumber, setPoNumber] = useState("");
  const [type, setType] = useState<POType>("storage");
  const [boxCount, setBoxCount] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [deptId, setDeptId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const amount = useMemo(
    () => Number(((boxCount || 0) * (unitPrice || 0)).toFixed(2)),
    [boxCount, unitPrice],
  );

  const currentInventory = useMemo(() => {
    if (!deptId) return null;
    return inventory.find((i) => i.department_id === deptId)?.total_boxes ?? 0;
  }, [deptId, inventory]);

  const urgentInsufficient =
    type === "urgent_retrieval" && deptId && boxCount > (currentInventory ?? 0);

  useEffect(() => {
    // Suggest a sensible default unit price per type when empty
    if (unitPrice === 0) {
      if (type === "storage") setUnitPrice(2);
      else if (type === "transport") setUnitPrice(5);
      else if (type === "urgent_retrieval") setUnitPrice(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (urgentInsufficient) {
      toast.error("Insufficient stock for urgent retrieval.");
      return;
    }
    if (!boxCount || boxCount <= 0) {
      toast.error("Box count is required.");
      return;
    }
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
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        po_number: poNumber,
        po_type: type,
        amount,
        box_count: boxCount,
        unit_price: unitPrice,
        department_id: type === "transport" ? null : (deptId || null),
        period_start: periodStart || null,
        period_end: periodEnd || null,
        description: description || null,
        created_by: userId,
        attachment_url,
        attachment_name,
      }).select().single();
      if (error) throw error;

      // Allocation
      if (type === "storage" && po.department_id) {
        await supabase.from("cost_allocations").insert({
          purchase_order_id: po.id, department_id: po.department_id, amount,
          cart_count: boxCount, notes: `Storage: ${boxCount} boxes × $${unitPrice}`,
        });
      } else if (type === "urgent_retrieval" && po.department_id) {
        await supabase.from("cost_allocations").insert({
          purchase_order_id: po.id, department_id: po.department_id, amount,
          cart_count: boxCount, notes: `Urgent: ${boxCount} boxes × $${unitPrice}`,
        });
      } else if (type === "transport") {
        // Pro-rate transport across departments by inventory share
        const totals = inventory.filter((i) => i.total_boxes > 0);
        const totalBoxes = totals.reduce((a, b) => a + b.total_boxes, 0) || 1;
        const rows = totals.map((i) => ({
          purchase_order_id: po.id,
          department_id: i.department_id,
          cart_count: i.total_boxes,
          amount: Number(((i.total_boxes / totalBoxes) * amount).toFixed(2)),
          notes: `Pro-rated transport (${i.total_boxes}/${totalBoxes})`,
        }));
        if (rows.length) await supabase.from("cost_allocations").insert(rows);
      }

      toast.success("Purchase order created and allocated");
      setPoNumber(""); setBoxCount(0); setUnitPrice(0); setDeptId("");
      setDescription(""); setFile(null);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div>
        <Label>PO Number</Label>
        <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required />
      </div>
      <div>
        <Label>Type</Label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as POType)}
        >
          <option value="storage">Storage</option>
          <option value="transport">Transport (pro-rated)</option>
          <option value="urgent_retrieval">Urgent Retrieval</option>
        </select>
      </div>

      {type !== "transport" && (
        <div>
          <Label>Department</Label>
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2"
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {deptId && (
            <p className="text-xs text-slate-500 mt-1">
              Current inventory: <span className="font-medium">{currentInventory} boxes</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>
            {type === "storage" ? "Box Count" : type === "transport" ? "Total Box Count" : "Urgent Box Count"}
          </Label>
          <Input
            type="number" min={1}
            value={boxCount || ""}
            onChange={(e) => setBoxCount(parseInt(e.target.value) || 0)}
            required
          />
        </div>
        <div>
          <Label>Unit Price ($/box)</Label>
          <Input
            type="number" step="0.01" min={0}
            value={unitPrice || ""}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
      </div>

      <div>
        <Label>Amount (auto-calculated)</Label>
        <Input value={`$${amount.toFixed(2)}`} disabled />
      </div>

      {urgentInsufficient && (
        <p className="text-xs text-red-600">
          ⚠ Insufficient stock for urgent retrieval ({currentInventory} available).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div><Label>Period start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
        <div><Label>Period end</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
      </div>
      <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div>
        <Label>Attachment (optional)</Label>
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <p className="text-xs text-slate-500 mt-1">{file.name}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={!!urgentInsufficient}>
        Create PO + allocate
      </Button>
    </form>
  );
}
