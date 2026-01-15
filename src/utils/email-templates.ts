export interface MessageNotificationData {
  senderName: string;
  senderUsername?: string;
  messageContent: string;
  messageUrl: string;
}

export interface MentionNotificationData {
  senderName: string;
  senderUsername?: string;
  commentContent: string;
  postUrl: string;
}

export function generateMessageNotificationEmail(data: MessageNotificationData): { subject: string; html: string; text: string } {
  const senderDisplay = data.senderName || data.senderUsername || 'Someone';
  const subject = `New message from ${senderDisplay}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5;">
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                New Message
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                You received a new message from <strong>${escapeHtml(senderDisplay)}</strong>:
              </p>
              <div style="background-color: #f9f9f9; border-left: 3px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #2a2a2a; white-space: pre-wrap;">${escapeHtml(data.messageContent)}</p>
              </div>
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td>
                    <a href="${data.messageUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px;">
                      View Message
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 20px; color: #8a8a8a;">
                This is an automated notification. You can reply to this message in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
New Message

You received a new message from ${senderDisplay}:

${data.messageContent}

View the message: ${data.messageUrl}

This is an automated notification. You can reply to this message in the app.
  `.trim();

  return { subject, html, text };
}

export function generateMentionNotificationEmail(data: MentionNotificationData): { subject: string; html: string; text: string } {
  const senderDisplay = data.senderName || data.senderUsername || 'Someone';
  const subject = `${senderDisplay} mentioned you in a comment`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5;">
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                You were mentioned
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                <strong>${escapeHtml(senderDisplay)}</strong> mentioned you in a comment:
              </p>
              <div style="background-color: #f9f9f9; border-left: 3px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #2a2a2a; white-space: pre-wrap;">${escapeHtml(data.commentContent)}</p>
              </div>
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td>
                    <a href="${data.postUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px;">
                      View Comment
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 20px; color: #8a8a8a;">
                This is an automated notification. You can reply to this comment in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
You were mentioned

${senderDisplay} mentioned you in a comment:

${data.commentContent}

View the comment: ${data.postUrl}

This is an automated notification. You can reply to this comment in the app.
  `.trim();

  return { subject, html, text };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

