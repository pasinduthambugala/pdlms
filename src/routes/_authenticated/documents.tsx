import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocsList,
});

function DocsList() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

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
          <h1 className="text-2xl font-bold text-slate-900">Document Registry</h1>
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
                    <Link
                      to="/carts/$cartId"
                      params={{ cartId: d.cart_id }}
                      className="text-slate-900 hover:underline"
                    >
                      {d.carts?.cart_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.file_number ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{d.file_name ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RegisterDocDialog({ onDone }: { onDone: () => void }) {
  const { data: user } = useCurrentUser();

  // Draft carts the user can add documents to (RLS narrows to dept).
  const { data: carts } = useQuery({
    queryKey: ["draft-carts"],
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

  const [cartId, setCartId] = useState("");
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [retention, setRetention] = useState(365);
  const [fileNum, setFileNum] = useState("");
  const [fileName, setFileName] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user || !cartId) throw new Error("Select a cart");
      const cart = carts?.find((c: any) => c.id === cartId);
      if (!cart) throw new Error("Cart not found");
      const { error } = await supabase.from("documents").insert({
        cart_id: cartId,
        document_name: name,
        document_number: num,
        retention_period: retention,
        file_number: fileNum || null,
        file_name: fileName || null,
        department_id: cart.department_id,
        created_by: user.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document registered");
      setName(""); setNum(""); setFileNum(""); setFileName("");
      onDone();
    },
    onError: (e: any) => {
      if (String(e.message).includes("duplicate")) toast.error("Document number must be unique");
      else if (String(e.message).includes("capacity")) toast.error("Cart is at full capacity (60 documents)");
      else toast.error(e.message);
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Register a document</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        className="space-y-3"
      >
        <div>
          <Label>Cart</Label>
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            value={cartId}
            onChange={(e) => setCartId(e.target.value)}
            required
          >
            <option value="">Select a draft/retrieved cart…</option>
            {carts?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.cart_number} ({c.status})
              </option>
            ))}
          </select>
          {!carts?.length && (
            <p className="text-xs text-amber-700 mt-1">
              No editable carts. <Link to="/carts/new" className="underline">Create a cart</Link> first.
            </p>
          )}
        </div>
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
            <Input type="number" min={1} value={retention} onChange={(e) => setRetention(parseInt(e.target.value) || 0)} required />
          </div>
          <div>
            <Label>File number (optional)</Label>
            <Input value={fileNum} onChange={(e) => setFileNum(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>File name (optional)</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
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
