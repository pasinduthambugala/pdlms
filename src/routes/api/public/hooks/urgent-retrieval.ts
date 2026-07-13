// Immediate URGENT retrieval notification: called from a DB trigger when
// a cart transitions to retrieval_approved with retrieval_type = 'urgent'.
// Sends an email with a PDF attachment of the cart + document details.
import { createFileRoute } from "@tanstack/react-router";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function buildPdf(cart: any, docs: any[]): Promise<string> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const draw = (text: string, x: number, size = 11, f = font, color = rgb(0.1, 0.1, 0.15)) => {
    page.drawText(text, { x, y, size, font: f, color });
    y -= size + 6;
  };

  draw("DARMS — URGENT RETRIEVAL", 50, 18, bold, rgb(0.75, 0.1, 0.15));
  draw(`Cart #: ${cart.cart_number}`, 50, 12, bold);
  draw(`Department: ${cart.departments?.name ?? "—"}`, 50);
  draw(`Approved at: ${new Date(cart.approved_at ?? cart.updated_at).toLocaleString()}`, 50);
  draw(`Retention (days): ${cart.retention_days ?? "—"}`, 50);
  draw(`Disposal date: ${cart.disposal_date ?? "—"}`, 50);
  y -= 10;
  draw(`Documents (${docs.length}):`, 50, 13, bold);
  y -= 4;

  page.drawText("Doc #", { x: 50, y, size: 10, font: bold });
  page.drawText("Name", { x: 130, y, size: 10, font: bold });
  page.drawText("File", { x: 330, y, size: 10, font: bold });
  page.drawText("Retention (yrs)", { x: 450, y, size: 10, font: bold });
  y -= 14;

  for (const d of docs) {
    if (y < 60) { y = 800; pdf.addPage([595.28, 841.89]); }
    page.drawText(String(d.document_number ?? "—").slice(0, 20), { x: 50, y, size: 10, font });
    page.drawText(String(d.document_name ?? "—").slice(0, 40), { x: 130, y, size: 10, font });
    page.drawText(String(d.file_name ?? "—").slice(0, 24), { x: 330, y, size: 10, font });
    page.drawText(String(d.retention_period ?? "—"), { x: 450, y, size: 10, font });
    y -= 14;
  }

  const bytes = await pdf.save();
  // base64 encode
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

async function sendEmailWithPdf(to: string, subject: string, html: string, filename: string, pdfB64: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DARMS <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[urgent-retrieval] RESEND_API_KEY not set — skipping delivery");
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from, to, subject, html,
      attachments: [{ filename, content: pdfB64 }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body}`);
  return { id: JSON.parse(body).id };
}

export const Route = createFileRoute("/api/public/hooks/urgent-retrieval")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cart_id } = (await request.json().catch(() => ({}))) as { cart_id?: string };
        if (!cart_id) return new Response(JSON.stringify({ error: "cart_id required" }), { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cart, error } = await supabaseAdmin
          .from("carts")
          .select("id, cart_number, department_id, retention_days, disposal_date, approved_at, updated_at, retrieval_type, status, departments(name), documents(id,document_name,document_number,file_name,file_number,retention_period)")
          .eq("id", cart_id)
          .maybeSingle();
        if (error || !cart) {
          return new Response(JSON.stringify({ error: error?.message ?? "cart not found" }), { status: 404 });
        }
        if ((cart as any).retrieval_type !== "urgent" || (cart as any).status !== "retrieval_approved") {
          return new Response(JSON.stringify({ skipped: true, reason: "cart not urgent-approved" }), { status: 200 });
        }

        const { data: settings } = await supabaseAdmin
          .from("app_settings").select("provider_email").eq("id", true).maybeSingle();
        const providerEmail = (settings as any)?.provider_email as string | undefined;
        if (!providerEmail) {
          return new Response(JSON.stringify({ ok: false, reason: "provider_email not set" }), { status: 200 });
        }

        const docs = (cart as any).documents ?? [];
        const pdfB64 = await buildPdf(cart, docs);

        const html = `
          <div style="font-family:Arial,sans-serif;color:#0f172a;">
            <h1 style="color:#b91c1c;margin:0 0 6px;">URGENT Retrieval Approved</h1>
            <p><strong>Cart:</strong> ${(cart as any).cart_number}<br/>
               <strong>Department:</strong> ${(cart as any).departments?.name ?? "—"}<br/>
               <strong>Documents:</strong> ${docs.length}<br/>
               <strong>Approved:</strong> ${new Date((cart as any).approved_at ?? (cart as any).updated_at).toLocaleString()}</p>
            <p>Full details attached as PDF.</p>
          </div>`;

        try {
          const result = await sendEmailWithPdf(
            providerEmail,
            `URGENT Retrieval — ${(cart as any).cart_number}`,
            html,
            `urgent-${(cart as any).cart_number}.pdf`,
            pdfB64,
          );
          await supabaseAdmin.from("notifications").insert({
            type: "urgent_retrieval",
            recipient: providerEmail,
            department_id: (cart as any).department_id,
            subject: `URGENT Retrieval — ${(cart as any).cart_number}`,
            body: html.replace(/<[^>]+>/g, " "),
            payload: { cart_id },
          });
          return new Response(JSON.stringify({ ok: true, result }), { headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          console.error("urgent send failed", e);
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
        }
      },
    },
  },
});
