import { createTransport, Transporter } from 'nodemailer';
import { Subscriber } from './subscribers';
import { generateNewsletterHTML, formatInterests } from './email-template';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: Transporter | null;

  constructor() {
    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials not configured. Email sending will be disabled.');
      this.transporter = null;
      return;
    }

    this.transporter = createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, content: EmailContent, cc?: string): Promise<boolean> {
    try {
      if (!this.transporter) {
        console.log('SMTP not configured - simulating email send to:', to);
        if (cc) console.log('CC:', cc);
        console.log('Subject:', content.subject);
        return true; // Return true for testing purposes
      }

      const mailOptions: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
        cc?: string;
      } = {
        from: `"OpenMidmarket" <hello@openmidmarket.com>`,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      };

      if (cc) {
        mailOptions.cc = cc;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendNewsletterToSubscriber(subscriber: Subscriber, rssContent: string, articles?: Array<{title: string, description?: string, source?: string}>, cc?: string): Promise<boolean> {
    const locations = this.buildLocationString(subscriber.selectedCounties);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const newsletterTitle = "OpenMidMarket News";

    const subject = `${dateStr} - ${newsletterTitle}`;

    const html = this.generateEmailHTML(subscriber, rssContent, locations, newsletterTitle);
    const text = this.generateEmailText(subscriber, rssContent, locations);

    return await this.sendEmail(subscriber.email, { subject, html, text }, cc);
  }

  private buildLocationString(counties: string[]): string {
    const locations: string[] = [];

    // Add county names
    counties.forEach(countyId => {
      locations.push(countyId);
    });

    return locations.join(', ');
  }

  private generateEmailHTML(subscriber: Subscriber, rssContent: string, locations: string, title?: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.openmidmarket.com';
    return generateNewsletterHTML({
      subscriberName: subscriber.firstName,
      locations,
      interests: subscriber.interests,
      content: rssContent,
      title,
      subscriberEmail: subscriber.email,
      unsubscribeUrl: `${baseUrl}/api/news/unsubscribe?email=${encodeURIComponent(subscriber.email)}`
    });
  }

  private generateEmailText(subscriber: Subscriber, rssContent: string, locations: string): string {
    const formattedInterests = formatInterests(subscriber.interests);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.openmidmarket.com';
    const interestsSection = formattedInterests ? `
Your Interests: ${formattedInterests}

` : '';

    return `
Your Weekly CRE News
Hello ${subscriber.firstName}! Here's your personalized commercial real estate news${locations ? ` for ${locations}` : ''}.

${interestsSection}${rssContent}

---
You're receiving this because you subscribed to OpenMidmarket.
Unsubscribe: ${baseUrl}/api/news/unsubscribe?email=${encodeURIComponent(subscriber.email)}
`;
  }
}
