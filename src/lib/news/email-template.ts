export interface NewsletterTemplateData {
  subscriberName: string;
  locations?: string;
  interests?: string;
  content: string;
  unsubscribeUrl: string;
  isPreview?: boolean;
  title?: string;
  subscriberEmail?: string;
}

export function formatInterests(interests: string | null | undefined): string {
  if (!interests) return '';

  try {
    // Try to parse as JSON array
    const parsed = JSON.parse(interests);
    if (Array.isArray(parsed)) {
      // Join items with a space (assuming each item already ends with a period)
      return parsed.join(' ');
    }
    // If not an array, return as is
    return interests;
  } catch {
    // If parsing fails, return as is
    return interests;
  }
}

export function generateNewsletterHTML(data: NewsletterTemplateData): string {
  const { content, unsubscribeUrl, interests, locations, subscriberEmail } = data;
  const formattedInterests = formatInterests(interests);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.openmidmarket.com';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRE News</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { padding: 20px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #000; text-align: center; }
        .header p { margin: 5px 0 0 0; color: #000; }
        .content { background-color: #fff; padding: 20px; }
        .article { margin-bottom: 20px; padding-bottom: 20px; }
        .article h3 { margin: 0 0 10px 0; color: #2c3e50; font-size: 16px; font-weight: bold; }
        .article h3 a { color: #000; text-decoration: underline; }
        .article h3 a:hover { text-decoration: underline; }
        .article p { margin: 0; color: #000; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
        .footer a { color: #666; }
        .interests-section { margin-bottom: 20px; text-align: center; }
        .interests-section p { margin: 0; color: #000; }
    </style>
</head>
<body>
    <div class="content">
        ${content}
    </div>

    ${formattedInterests ? `
    <div class="interests-section">
        <p><strong>Your interests:</strong> ${formattedInterests}</p>
    </div>
    ` : `
    <div class="interests-section">
        <p style="font-size: 12px; color: #666;">
            Want more personalized content?
            <a href="${baseUrl}/news/settings" style="color: #666; text-decoration: underline;">Add your interests here</a> to get articles tailored to your preferences.
        </p>
    </div>
    `}

    ${locations ? `
    <div class="interests-section">
        <p><strong>Your regions:</strong> ${locations}</p>
    </div>
    ` : ''}

    <div class="interests-section">
        <p style="font-size: 12px; color: #666; margin-top: 8px;">
            <a href="${baseUrl}/news/settings" style="color: #666; text-decoration: underline;">Edit your preferences here</a>
        </p>
    </div>

    <div class="footer">
        <p>You're receiving this because you subscribed to OpenMidmarket.</p>
        <p><a href="mailto:hello@openmidmarket.com">Submit Feedback</a></p>
        <p><a href="${unsubscribeUrl}">Unsubscribe</a></p>
    </div>
</body>
</html>`;
}
