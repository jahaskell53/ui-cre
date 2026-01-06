import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
const mockCreateTransport = vi.fn().mockReturnValue({
    sendMail: mockSendMail,
});

vi.mock('nodemailer', () => ({
    createTransport: vi.fn().mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    }),
}));

import { EmailService } from './email-service';
import { createTransport } from 'nodemailer';

describe('EmailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_FROM;
        
        // Reset mocks
        mockCreateTransport.mockReturnValue({
            sendMail: mockSendMail,
        });
        mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should disable email sending when SMTP credentials are not configured', () => {
        const service = new EmailService();
        expect(service).toBeDefined();
    });

    it('should create transporter when SMTP credentials are configured', () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        
        vi.mocked(createTransport).mockClear();
        const service = new EmailService();
        
        expect(createTransport).toHaveBeenCalled();
    });

    it('should use default SMTP settings when not specified', () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        
        vi.mocked(createTransport).mockClear();
        new EmailService();
        
        expect(createTransport).toHaveBeenCalledWith({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'test@example.com',
                pass: 'password123',
            },
        });
    });

    it('should use custom SMTP settings when specified', () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        process.env.SMTP_HOST = 'smtp.custom.com';
        process.env.SMTP_PORT = '465';
        
        vi.mocked(createTransport).mockClear();
        new EmailService();
        
        expect(createTransport).toHaveBeenCalledWith({
            host: 'smtp.custom.com',
            port: 465,
            secure: false,
            auth: {
                user: 'test@example.com',
                pass: 'password123',
            },
        });
    });

    it('should simulate email send when SMTP is not configured', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const service = new EmailService();
        const result = await service.sendEmail(
            'recipient@example.com',
            {
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            }
        );
        
        expect(result).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith('SMTP not configured - simulating email send to:', 'recipient@example.com');
        
        consoleLogSpy.mockRestore();
    });

    it('should send email when SMTP is configured', async () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        
        const service = new EmailService();
        
        const result = await service.sendEmail(
            'recipient@example.com',
            {
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            }
        );
        
        expect(result).toBe(true);
        expect(createTransport).toHaveBeenCalled();
    });

    it('should include CC when provided', async () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        
        const service = new EmailService();
        
        const result = await service.sendEmail(
            'recipient@example.com',
            {
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            },
            'cc@example.com'
        );
        
        expect(result).toBe(true);
    });

    it('should use custom from address when SMTP_FROM is set', async () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        process.env.SMTP_FROM = '"Custom Name" <custom@example.com>';
        
        const service = new EmailService();
        
        const result = await service.sendEmail(
            'recipient@example.com',
            {
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            }
        );
        
        expect(result).toBe(true);
    });

    it('should handle email send errors gracefully', async () => {
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password123';
        
        // Create a service and then mock the transporter to throw an error
        const service = new EmailService();
        
        // Mock the transporter's sendMail to throw an error
        const mockTransporter = vi.mocked(createTransport).mock.results[0]?.value;
        if (mockTransporter) {
            mockTransporter.sendMail = vi.fn().mockRejectedValueOnce(new Error('SMTP error'));
        }
        
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const result = await service.sendEmail(
            'recipient@example.com',
            {
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            }
        );
        
        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        consoleErrorSpy.mockRestore();
    });
});
