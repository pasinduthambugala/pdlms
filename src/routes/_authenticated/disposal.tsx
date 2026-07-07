import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/disposal")({
  component: Disposal,
});

function Disposal() {
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const upcomingQ = useQuery({
    queryKey: ["disposal-upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name)")
        .neq("status", "disposed")
        .not("disposal_date", "is", null)
        .order("disposal_date");
      if (error) throw error;
      return data;
    },
  });

  const historyQ = useQuery({
    queryKey: ["disposal-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_approvals")
        .select("*, carts(cart_number, department_id, departments(name))")
        .eq("action", "dispose")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean)));
      let actors: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name, email").in("id", ids as string[]);
        actors = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return (data ?? []).map((r: any) => ({ ...r, actor: actors[r.actor_id] }));
    },
  });

  const upcoming = useMemo(() => {
    const list = upcomingQ.data ?? [];
    return list.filter((c: any) => {
      const d = c.disposal_date ? new Date(c.disposal_date) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > new Date(to.getTime() + 86400000)) return false;
      // Default view when no range: next 14 days
      if (!from && !to) {
        const in14 = new Date(Date.now() + 14 * 86400000);
        return d <= in14;
      }
      return true;
    });
  }, [upcomingQ.data, from, to]);

  const history = useMemo(() => {
    const list = historyQ.data ?? [];
    return list.filter((r: any) => {
      const d = new Date(r.created_at);
      if (from && d < from) return false;
      if (to && d > new Date(to.getTime() + 86400000)) return false;
      return true;
    });
  }, [historyQ.data, from, to]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Disposal Alerts
          </h1>
          <p className="text-sm text-slate-500">
            {from || to ? "Carts within selected date range." : "Carts reaching disposal date within 14 days."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          {(from || to) && (
            <Button size="sm" variant="ghost" onClick={() => { setFrom(undefined); setTo(undefined); }}>Clear</Button>
          )}
        </div>
      </header>

      <Card className="overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">
          Upcoming disposals
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Disposal date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {upcoming.length ? upcoming.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.cart_number}</td>
                <td className="px-4 py-3">{c.departments?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-rose-700 font-medium">{c.disposal_date}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/carts/$cartId" params={{ cartId: c.id }} className="font-medium hover:underline">Open →</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No carts in range.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">
          Disposal history
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Disposed on</th>
              <th className="text-left px-4 py-3">Disposed by</th>
              <th className="text-left px-4 py-3">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length ? history.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.carts?.cart_number ?? "—"}</td>
                <td className="px-4 py-3">{r.carts?.departments?.name ?? "—"}</td>
                <td className="px-4 py-3">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{r.actor?.full_name ?? r.actor?.email ?? "Unknown"}</td>
                <td className="px-4 py-3 text-slate-500">{r.comments ?? "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No disposals recorded.</td></tr>
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
