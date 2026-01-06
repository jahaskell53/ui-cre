import { createTransport, Transporter } from 'nodemailer';

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
        from: process.env.SMTP_FROM || `"Untitled UI" <noreply@untitledui.com>`,
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
}

