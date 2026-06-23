// supabase/functions/emailClient.ts
// Simple wrapper for sending emails via Resend (or any provider).
// The edge function runtime provides process.env variables.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.SENDER_EMAIL || 'no-reply@yourdomain.com',
      to,
      subject,
      html,
    });
    if (error) {
      console.error('Email send error:', error);
      throw error;
    }
    return data;
  } catch (e) {
    console.error('Failed to send email:', e);
    throw e;
  }
}
