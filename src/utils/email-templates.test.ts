import { describe, it, expect } from 'vitest';
import { generateMessageNotificationEmail } from './email-templates';

describe('generateMessageNotificationEmail', () => {
    it('should generate email with sender name', () => {
        const result = generateMessageNotificationEmail({
            senderName: 'John Doe',
            messageContent: 'Hello, how are you?',
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.subject).toBe('New message from John Doe');
        expect(result.html).toContain('John Doe');
        expect(result.html).toContain('Hello, how are you?');
        expect(result.html).toContain('https://example.com/messages?user_id=123');
        expect(result.text).toContain('John Doe');
        expect(result.text).toContain('Hello, how are you?');
        expect(result.text).toContain('https://example.com/messages?user_id=123');
    });

    it('should generate email with sender name', () => {
        const result = generateMessageNotificationEmail({
            senderName: 'johndoe',
            messageContent: 'Test message',
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.subject).toBe('New message from johndoe');
        expect(result.html).toContain('johndoe');
    });

    it('should escape HTML in message content', () => {
        const result = generateMessageNotificationEmail({
            senderName: 'John Doe',
            messageContent: '<script>alert("xss")</script>Hello & welcome',
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.html).toContain('&lt;script&gt;');
        expect(result.html).toContain('&amp;');
        expect(result.html).not.toContain('<script>');
        expect(result.text).toContain('<script>alert("xss")</script>Hello & welcome');
    });

    it('should handle multi-line message content', () => {
        const multiLineContent = 'Line 1\nLine 2\nLine 3';
        const result = generateMessageNotificationEmail({
            senderName: 'John Doe',
            messageContent: multiLineContent,
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.html).toContain('Line 1');
        expect(result.html).toContain('Line 2');
        expect(result.html).toContain('Line 3');
        expect(result.text).toContain(multiLineContent);
    });

    it('should include View Message button in HTML', () => {
        const result = generateMessageNotificationEmail({
            senderName: 'John Doe',
            messageContent: 'Test',
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.html).toContain('View Message');
        expect(result.html).toContain('href="https://example.com/messages?user_id=123"');
    });

    it('should use "Someone" as fallback when sender name is empty', () => {
        const result = generateMessageNotificationEmail({
            senderName: '',
            messageContent: 'Test',
            messageUrl: 'https://example.com/messages?user_id=123',
        });

        expect(result.subject).toBe('New message from Someone');
        expect(result.html).toContain('Someone');
    });
});

