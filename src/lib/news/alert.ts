import { EmailService } from './newsletter-service';

/**
 * Send a plain-text alert email to ALERT_EMAIL (falls back to SMTP_USER).
 * Uses the same SMTP transport as the newsletter sender.
 * Silently no-ops if SMTP is not configured.
 */
export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const to = process.env.ALERT_EMAIL || process.env.SMTP_USER;
  if (!to) return;

  try {
    const emailService = new EmailService();
    await emailService.sendEmail(to, {
      subject,
      text: body,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
    });
  } catch (err) {
    // Don't let alerting failures mask the original error
    console.error('Failed to send alert email:', err);
  }
}
