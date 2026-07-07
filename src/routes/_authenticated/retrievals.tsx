import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/retrievals")({
  component: Retrievals,
});

function Retrievals() {
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const { data } = useQuery({
    queryKey: ["retrievals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name)")
        .in("status", [
          "pending_retrieval_approval", "retrieval_approved",
          "retrieved", "pending_return_approval", "return_approved",
        ])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((c: any) => {
      const d = new Date(c.updated_at ?? c.created_at);
      if (from && d < from) return false;
      if (to && d > new Date(to.getTime() + 86400000)) return false;
      return true;
    });
  }, [data, from, to]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Retrievals</h1>
          <p className="text-sm text-slate-500">Open retrieval and return workflow items.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          {(from || to) && (
            <Button size="sm" variant="ghost" onClick={() => { setFrom(undefined); setTo(undefined); }}>Clear</Button>
          )}
        </div>
      </header>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.cart_number}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">{c.retrieval_type ? <Badge variant={c.retrieval_type === "urgent" ? "destructive" : "secondary"}>{c.retrieval_type}</Badge> : "—"}</td>
                <td className="px-4 py-3">{c.departments?.name}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(c.updated_at ?? c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/carts/$cartId" params={{ cartId: c.id }} className="font-medium hover:underline">Open →</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nothing matches.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
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
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}
