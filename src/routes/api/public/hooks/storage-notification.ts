// Daily 3 PM: notify storage provider of all Approved carts per department.
// Logs an entry per email into public.notifications. Actual email delivery requires
// a verified email domain (Lovable Emails) — wire your sender in the marked block.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/storage-notification")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: approved, error } = await supabaseAdmin
          .from("carts")
          .select("id, cart_number, department_id, retention_days, disposal_date, created_at, departments(name)")
          .eq("status", "approved")
          .is("storage_notified_at", null);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // Group by department
        const groups = new Map<string, { name: string; carts: any[] }>();
        for (const c of approved ?? []) {
          const key = c.department_id;
          if (!groups.has(key)) groups.set(key, { name: (c as any).departments?.name ?? "Unknown", carts: [] });
          groups.get(key)!.carts.push(c);
        }

        const PROVIDER_EMAIL = process.env.STORAGE_PROVIDER_EMAIL ?? "pasinduthambugala@gmail.com";
        let sent = 0;

        for (const [deptId, { name, carts }] of groups) {
          const subject = `DARMS storage pickup — ${name} (${carts.length} cart${carts.length === 1 ? "" : "s"})`;
          const body =
            `Department: ${name}\n\nCarts ready for storage:\n` +
            carts.map((c) => `- ${c.cart_number} (retention ${c.retention_days}d, disposal ${c.disposal_date})`).join("\n");

          // === Email delivery hook ===
          // TODO: integrate Lovable Emails / Resend here. Currently logged only.

          await supabaseAdmin.from("notifications").insert({
            type: "storage_pickup",
            recipient: PROVIDER_EMAIL,
            department_id: deptId,
            subject,
            body,
            payload: { cart_ids: carts.map((c) => c.id) },
          });

          await supabaseAdmin
            .from("carts")
            .update({ storage_notified_at: new Date().toISOString() })
            .in("id", carts.map((c) => c.id));

          sent++;
        }

        return new Response(JSON.stringify({ ok: true, departments_notified: sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
