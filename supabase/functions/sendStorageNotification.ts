// supabase/functions/sendStorageNotification.ts
// Edge Function invoked by pg_cron (daily at 15:00) to email the third‑party provider
// with all carts that are Approved and ready for storage.

import { serve } from 'https://deno.land/x/sift/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from './emailClient.ts';

// Initialize Supabase client with service role key (provided as env var)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Only allow POST from cron
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Fetch approved carts that have not yet been marked as Stored
  const { data: carts, error } = await supabase
    .from('carts')
    .select('id, cart_number, department_id')
    .eq('status', 'Approved');

  if (error) {
    console.error('Error fetching carts:', error);
    return new Response('Error fetching carts', { status: 500 });
  }

  if (!carts || carts.length === 0) {
    return new Response('No approved carts', { status: 200 });
  }

  // Build email HTML
  const cartRows = carts
    .map((c: any) => `<tr><td>${c.cart_number}</td><td>${c.id}</td></tr>`)
    .join('');

  const html = `
    <h2>Daily Storage Notification</h2>
    <p>Please collect the following approved carts:</p>
    <table border="1" cellpadding="5" cellspacing="0">
      <thead><tr><th>Cart Number</th><th>Cart ID</th></tr></thead>
      <tbody>${cartRows}</tbody>
    </table>
  `;

  // Email address of third‑party provider – set via env var
  const providerEmail = Deno.env.get('PROVIDER_EMAIL') ?? '';

  try {
    await sendEmail({
      to: providerEmail,
      subject: 'DARMS Daily Storage Notification',
      html,
    });
    return new Response('Emails sent', { status: 200 });
  } catch (e) {
    console.error('Email send failure:', e);
    return new Response('Email send failure', { status: 500 });
  }
});
