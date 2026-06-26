import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus, Search, Eye } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABELS, type CartStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/carts/")({
  component: CartsList,
});

const FILTER_STATUSES: CartStatus[] = [
  "draft", "pending_approval", "approved", "stored",
  "retrieved", "pending_return_approval",
];

function CartsList() {
  const { data: user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [viewId, setViewId] = useState<string | null>(null);

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
      return true;
    });
  }, [carts, search, status]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cart Management</h1>
          <p className="text-sm text-slate-500">Document carts and their lifecycle status.</p>
        </div>
        <Link to="/carts/new">
          <Button disabled={!user?.profile.is_active}>
            <Plus className="w-4 h-4 mr-2" /> New cart
          </Button>
        </Link>
      </header>

      <Card className="p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cart number…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
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

function CartViewDialog({ cartId, onClose }: { cartId: string | null; onClose: () => void }) {
  const { data: cart } = useQuery({
    queryKey: ["cart-view", cartId],
    enabled: !!cartId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name), documents(id, document_number, document_name)")
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
              <div className="border border-slate-100 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Number</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-right px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docs.length ? docs.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-mono text-xs">{d.document_number}</td>
                        <td className="px-3 py-2">{d.document_name}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">No documents.</td></tr>
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
