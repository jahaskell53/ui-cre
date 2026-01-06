import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createClient } from '@/utils/supabase/server';
import { sendMessageNotificationEmail } from '@/utils/send-message-notification-email';
import { NextRequest } from 'next/server';

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock the email sending function
vi.mock('@/utils/send-message-notification-email', () => ({
  sendMessageNotificationEmail: vi.fn(),
}));

describe('POST /api/notifications/send-email', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any);
    vi.mocked(sendMessageNotificationEmail).mockResolvedValue(true);
  });

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        message_id: 'msg-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if neither notification_id nor message_id is provided', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('notification_id or message_id is required');
  });

  it('should send email for message_id', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        message_id: 'msg-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendMessageNotificationEmail).toHaveBeenCalledWith('msg-123');
  });

  it('should send email for notification_id', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'notif-123', related_id: 'msg-456' },
          error: null,
        }),
      }),
    });

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        notification_id: 'notif-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendMessageNotificationEmail).toHaveBeenCalledWith('msg-456');
  });

  it('should return 404 if notification not found', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }),
    });

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        notification_id: 'notif-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Notification not found');
  });

  it('should return 400 if notification has no related message', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'notif-123', related_id: null },
          error: null,
        }),
      }),
    });

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        notification_id: 'notif-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Notification has no related message');
  });

  it('should return 500 if email sending fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    vi.mocked(sendMessageNotificationEmail).mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/notifications/send-email', {
      method: 'POST',
      body: JSON.stringify({
        message_id: 'msg-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to send email');
  });
});

