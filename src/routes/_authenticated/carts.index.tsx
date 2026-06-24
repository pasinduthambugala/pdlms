import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carts")({
  component: CartsList,
});

function CartsList() {
  const { data: user } = useCurrentUser();
  const { data: carts } = useQuery({
    queryKey: ["carts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Carts</h1>
          <p className="text-sm text-slate-500">Document carts and their lifecycle status.</p>
        </div>
        <Link to="/carts/new">
          <Button disabled={!user?.profile.is_active}>
            <Plus className="w-4 h-4 mr-2" /> New cart
          </Button>
        </Link>
      </header>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Retention</th>
              <th className="text-left px-4 py-3">Disposal date</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carts?.length ? carts.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.cart_number}</td>
                <td className="px-4 py-3">{c.departments?.name ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">{c.retention_days} days</td>
                <td className="px-4 py-3">{c.disposal_date ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/carts/$cartId" params={{ cartId: c.id }} className="text-slate-900 font-medium hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No carts yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
