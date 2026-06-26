import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocsList,
});

function DocsList() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, carts(cart_number, status), departments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d: any) =>
      [d.document_name, d.document_number, d.file_number, d.file_name, d.carts?.cart_number]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">All documents you have access to.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!user?.profile.is_active}>
              <Plus className="w-4 h-4 mr-2" /> Register document
            </Button>
          </DialogTrigger>
          <RegisterDocDialog
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["documents"] });
            }}
          />
        </Dialog>
      </header>

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document #, file #, name, or cart #"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Document Name</th>
              <th className="text-left px-4 py-3">Document Number</th>
              <th className="text-left px-4 py-3">Retention Period</th>
              <th className="text-left px-4 py-3">Cart Number</th>
              <th className="text-left px-4 py-3">File Number</th>
              <th className="text-left px-4 py-3">File Name</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? (
              filtered.map((d: any) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{d.document_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.document_number}</td>
                  <td className="px-4 py-3 text-slate-600">{d.retention_period} days</td>
                  <td className="px-4 py-3">
                    {d.cart_id && d.carts ? (
                      <Link to="/carts/$cartId" params={{ cartId: d.cart_id }}
                        className="text-slate-900 hover:underline">
                        {d.carts.cart_number}
                      </Link>
                    ) : (
                      <span className="text-amber-700 text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.file_number ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{d.file_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setAssignId(d.id)}>
                      <Pencil className="w-4 h-4 mr-1" /> Update cart
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <AssignCartDialog
        docId={assignId}
        onClose={() => setAssignId(null)}
        onDone={() => {
          setAssignId(null);
          qc.invalidateQueries({ queryKey: ["documents"] });
        }}
      />
    </div>
  );
}

function useEditableCarts() {
  return useQuery({
    queryKey: ["editable-carts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("id, cart_number, department_id, status")
        .in("status", ["draft", "retrieved"])
        .order("cart_number");
      if (error) throw error;
      return data;
    },
  });
}

function RegisterDocDialog({ onDone }: { onDone: () => void }) {
  const { data: user } = useCurrentUser();
  const { data: carts } = useEditableCarts();

  const [cartId, setCartId] = useState<string>("none");
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [retention, setRetention] = useState(365);
  const [fileNum, setFileNum] = useState("");
  const [fileName, setFileName] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const chosen = cartId !== "none" ? carts?.find((c: any) => c.id === cartId) : null;
      const departmentId = chosen?.department_id ?? user.profile.department_id;
      if (!departmentId) throw new Error("Your profile has no department assigned. Ask an admin.");
      const { error } = await supabase.from("documents").insert({
        cart_id: chosen ? chosen.id : null,
        document_name: name,
        document_number: num,
        retention_period: retention,
        file_number: fileNum || null,
        file_name: fileName || null,
        department_id: departmentId,
        created_by: user.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document registered");
      setName(""); setNum(""); setFileNum(""); setFileName(""); setCartId("none");
      onDone();
    },
    onError: (e: any) => {
      const m = String(e.message);
      if (m.includes("duplicate")) toast.error("Document number must be unique");
      else if (m.includes("capacity")) toast.error("Cart is at full capacity (60 documents)");
      else toast.error(m);
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Register a document</DialogTitle>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Document name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Document number</Label>
            <Input value={num} onChange={(e) => setNum(e.target.value)} required />
          </div>
          <div>
            <Label>Retention period (days)</Label>
            <Input type="number" min={1} value={retention}
              onChange={(e) => setRetention(parseInt(e.target.value) || 0)} required />
          </div>
          <div>
            <Label>File number (optional)</Label>
            <Input value={fileNum} onChange={(e) => setFileNum(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>File name (optional)</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Cart (optional — can be assigned later)</Label>
            <Select value={cartId} onValueChange={setCartId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No cart (assign later)</SelectItem>
                {carts?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.cart_number} ({c.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Register document"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function AssignCartDialog({
  docId, onClose, onDone,
}: { docId: string | null; onClose: () => void; onDone: () => void }) {
  const { data: carts } = useEditableCarts();
  const [cartId, setCartId] = useState<string>("none");

  const mut = useMutation({
    mutationFn: async () => {
      if (!docId) return;
      const chosen = cartId !== "none" ? carts?.find((c: any) => c.id === cartId) : null;
      const updates: any = { cart_id: chosen ? chosen.id : null };
      if (chosen) updates.department_id = chosen.department_id;
      const { error } = await supabase.from("documents").update(updates).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cart updated");
      onDone();
    },
    onError: (e: any) => {
      const m = String(e.message);
      if (m.includes("capacity")) toast.error("Cart is at full capacity (60 documents)");
      else toast.error(m);
    },
  });

  return (
    <Dialog open={!!docId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update cart assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Cart</Label>
          <Select value={cartId} onValueChange={setCartId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {carts?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.cart_number} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
