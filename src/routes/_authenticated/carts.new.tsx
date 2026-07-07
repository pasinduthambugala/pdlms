import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
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

const DEFAULT_RETENTION_DAYS = 365 * 7; // 7 years default; not user-editable here

function NewCart() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const [cartNumber, setCartNumber] = useState("");
  const [loading, setLoading] = useState(false);

  // Block department heads from creating carts.
  if (user && user.roles.includes("dept_head") && !user.roles.includes("super_admin")) {
    return <Navigate to="/carts" />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!user.profile.department_id) {
      toast.error("Your profile has no department assigned. Ask an admin.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("carts").insert({
        cart_number: cartNumber,
        retention_days: DEFAULT_RETENTION_DAYS,
        department_id: user.profile.department_id,
        created_by: user.userId,
        status: "draft",
      }).select().single();
      if (error) throw error;
      await supabase.from("cart_approvals").insert({
        cart_id: data.id, action: "create", actor_id: user.userId,
      });
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
          <p className="text-xs text-slate-500">
            Department is set automatically from your profile. Retention is applied per
            document — you do not enter a retention period here.
          </p>
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
