// Daily: find carts whose disposal_date is within 14 days and not yet alerted.
// Logs notification rows per department; wire actual email delivery as needed.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/disposal-alerts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        const { data: carts, error } = await supabaseAdmin
          .from("carts")
          .select("id, cart_number, department_id, disposal_date, departments(name)")
          .lte("disposal_date", in14)
          .neq("status", "disposed")
          .eq("disposal_alert_sent", false);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const groups = new Map<string, { name: string; carts: any[] }>();
        for (const c of carts ?? []) {
          const key = c.department_id;
          if (!groups.has(key)) groups.set(key, { name: (c as any).departments?.name ?? "Unknown", carts: [] });
          groups.get(key)!.carts.push(c);
        }

        let alerts = 0;
        for (const [deptId, { name, carts: list }] of groups) {
          const subject = `DARMS disposal alert — ${name} (${list.length} cart${list.length === 1 ? "" : "s"})`;
          const body =
            `The following carts will reach disposal within 14 days:\n\n` +
            list.map((c) => `- ${c.cart_number} (disposal ${c.disposal_date})`).join("\n");

          await supabaseAdmin.from("notifications").insert({
            type: "disposal_alert",
            department_id: deptId,
            subject, body,
            payload: { cart_ids: list.map((c) => c.id) },
          });

          await supabaseAdmin
            .from("carts")
            .update({ disposal_alert_sent: true })
            .in("id", list.map((c) => c.id));

          alerts++;
        }

        return new Response(JSON.stringify({ ok: true, departments_alerted: alerts }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
