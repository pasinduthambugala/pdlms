// Daily 3 PM: notify storage provider with a single grouped email covering
// approved carts (for storage pickup) AND normal-priority retrieval-approved carts
// since the last successful send. Skips send entirely if there is nothing new.
// Urgent retrievals are handled by a separate immediate trigger.
import { createFileRoute } from "@tanstack/react-router";

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DARMS <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[storage-notification] RESEND_API_KEY not set — skipping delivery");
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body}`);
  return { id: JSON.parse(body).id };
}

function fmtCartRows(carts: any[]) {
  return carts.map((c) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${c.cart_number}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${c.retention_days ?? "—"}d</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${c.disposal_date ?? "—"}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${(c.documents ?? []).length}</td>
    </tr>`).join("");
}

function renderSection(title: string, byDept: Map<string, { name: string; carts: any[] }>) {
  if (byDept.size === 0) return "";
  let html = `<h2 style="color:#0f172a;font-family:Arial,sans-serif;margin-top:24px;">${title}</h2>`;
  for (const [, g] of byDept) {
    html += `<h3 style="color:#334155;font-family:Arial,sans-serif;margin:12px 0 6px;">${g.name} — ${g.carts.length} cart(s)</h3>`;
    html += `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
      <thead><tr>
        <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Cart #</th>
        <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Retention</th>
        <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Disposal</th>
        <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Docs</th>
      </tr></thead>
      <tbody>${fmtCartRows(g.carts)}</tbody></table>`;
    for (const c of g.carts) {
      const docs = c.documents ?? [];
      if (!docs.length) continue;
      html += `<div style="margin:6px 0 12px;font-family:Arial,sans-serif;font-size:12px;color:#475569;">
        <strong>${c.cart_number} — documents:</strong>
        <ul style="margin:4px 0 0 20px;padding:0;">
          ${docs.map((d: any) => `<li>${d.document_number} — ${d.document_name}${d.file_name ? ` (${d.file_name})` : ""}</li>`).join("")}
        </ul></div>`;
    }
  }
  return html;
}

export const Route = createFileRoute("/api/public/hooks/storage-notification")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: settings } = await supabaseAdmin
          .from("app_settings").select("*").eq("id", true).maybeSingle();
        const providerEmail = (settings as any)?.provider_email as string | undefined;
        const since = (settings as any)?.last_daily_sent_at ?? new Date(Date.now() - 24 * 3600_000).toISOString();

        if (!providerEmail) {
          return new Response(JSON.stringify({ ok: false, reason: "provider_email not set" }), { status: 200 });
        }

        // Approved carts (storage pickup) since last send
        const { data: approved } = await supabaseAdmin
          .from("carts")
          .select("id, cart_number, department_id, retention_days, disposal_date, approved_at, updated_at, departments(name), documents(id,document_name,document_number,file_name)")
          .eq("status", "approved")
          .gte("updated_at", since);

        // Normal retrieval-approved carts since last send (exclude urgent — those go instantly)
        const { data: retrieved } = await supabaseAdmin
          .from("carts")
          .select("id, cart_number, department_id, retention_days, disposal_date, retrieval_type, updated_at, departments(name), documents(id,document_name,document_number,file_name)")
          .eq("status", "retrieval_approved")
          .eq("retrieval_type", "normal")
          .gte("updated_at", since);

        const totalNew = (approved?.length ?? 0) + (retrieved?.length ?? 0);
        if (totalNew === 0) {
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no new approved activity" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const groupBy = (rows: any[] | null) => {
          const m = new Map<string, { name: string; carts: any[] }>();
          for (const c of rows ?? []) {
            const k = c.department_id;
            if (!m.has(k)) m.set(k, { name: c.departments?.name ?? "Unknown", carts: [] });
            m.get(k)!.carts.push(c);
          }
          return m;
        };

        const approvedByDept = groupBy(approved);
        const retrievedByDept = groupBy(retrieved);

        const html = `
          <div style="font-family:Arial,sans-serif;color:#0f172a;">
            <h1 style="margin:0 0 8px;">DARMS Daily Digest</h1>
            <p style="color:#475569;margin:0 0 8px;">Approved activity since ${new Date(since).toLocaleString()}.</p>
            ${renderSection("Storage — Approved Carts (Pickup)", approvedByDept)}
            ${renderSection("Retrievals — Approved (Normal Priority)", retrievedByDept)}
          </div>`;

        const subject = `DARMS daily digest — ${approved?.length ?? 0} storage, ${retrieved?.length ?? 0} retrievals`;

        let sendResult: any = null;
        try {
          sendResult = await sendEmail(providerEmail, subject, html);
        } catch (e: any) {
          console.error("send failed", e);
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
        }

        await supabaseAdmin.from("notifications").insert({
          type: "daily_digest",
          recipient: providerEmail,
          subject,
          body: html.replace(/<[^>]+>/g, " "),
          payload: {
            approved_ids: (approved ?? []).map((c: any) => c.id),
            retrieval_ids: (retrieved ?? []).map((c: any) => c.id),
          },
        });

        // Mark storage_notified_at on approved carts (best-effort)
        if (approved?.length) {
          await supabaseAdmin.from("carts")
            .update({ storage_notified_at: new Date().toISOString() })
            .in("id", approved.map((c: any) => c.id));
        }

        await supabaseAdmin.from("app_settings")
          .update({ last_daily_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", true);

        return new Response(JSON.stringify({ ok: true, sendResult, counts: { approved: approved?.length ?? 0, retrievals: retrieved?.length ?? 0 } }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
