import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/carts/new")({
  component: NewCart,
});

function NewCart() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const [cartNumber, setCartNumber] = useState("");
  const [retention, setRetention] = useState(365);
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Default to user's department.
  if (deptId === "" && user?.profile.department_id) setDeptId(user.profile.department_id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("carts").insert({
        cart_number: cartNumber,
        retention_days: retention,
        department_id: deptId,
        created_by: user.userId,
        status: "draft",
      }).select().single();
      if (error) throw error;
      toast.success("Cart created as draft");
      navigate({ to: "/carts/$cartId", params: { cartId: data.id } });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New cart</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="cn">Cart number (from storage provider)</Label>
            <Input id="cn" value={cartNumber} onChange={(e) => setCartNumber(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="rt">Retention period (days)</Label>
            <Input id="rt" type="number" min={1} value={retention} onChange={(e) => setRetention(parseInt(e.target.value))} required />
          </div>
          <div>
            <Label htmlFor="dept">Department</Label>
            <select id="dept" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
              <option value="">Select…</option>
              {departments?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={loading || !user?.profile.is_active}>
            {loading ? "Creating…" : "Create cart"}
          </Button>
          {!user?.profile.is_active && (
            <p className="text-xs text-amber-700">Your account must be activated by a Super Admin to create carts.</p>
          )}
        </form>
      </Card>
    </div>
  );
}
